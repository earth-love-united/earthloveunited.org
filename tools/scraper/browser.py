"""
═══════════════════════════════════════════════════════════════════════════
  BROWSER MANAGER — LightPanda CDP + Playwright
  
  Forked from Desktop/Afrika/scrapers/core/browser.py
  Adapted for carbon registry scraping (neutral fingerprint).
  
  Architecture:
    Mode 1 (LIGHTPANDA) — default:
      Start LightPanda as CDP server subprocess → connect Playwright over CDP.
      678KB Zig binary, ~1MB RAM, <2ms startup. Not Chrome. No fingerprint.
    
    Mode 2 (CHROMIUM) — fallback:
      Launch Chromium directly via Playwright with stealth injections.
      Heavy, detectable, but works when LP can't handle a site.

  Both modes expose the same context manager API.
═══════════════════════════════════════════════════════════════════════════
"""

import asyncio
import json
import logging
import os
import random
import subprocess
import signal
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

import httpx
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logger = logging.getLogger("scraper.browser")

# LightPanda binary location
LP_BINARY = Path(__file__).parent / "bin" / "lightpanda"
CDP_HOST = "127.0.0.1"
CDP_PORT = 9222
CDP_ENDPOINT = f"http://{CDP_HOST}:{CDP_PORT}"  # Playwright auto-discovers WS from HTTP

# Neutral browser fingerprint — carbon registries are public, no stealth needed
NEUTRAL_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

NEUTRAL_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)


class BrowserManager:
    """
    Manages browser connections for all scraping.
    Primary mode: LightPanda CDP server.
    Fallback mode: Direct Chromium launch.
    """

    def __init__(self, config: dict, mode: str = "lightpanda"):
        """
        Args:
            config: Full scraper config dict
            mode: "lightpanda" or "chromium"
        """
        self.config = config.get("browser", {})
        self.proxy_config = config.get("proxy", {})
        self.mode = mode
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._lp_proc: Optional[subprocess.Popen] = None
        self._active_contexts: list[BrowserContext] = []

    # ─── Lifecycle ──────────────────────────────────────────────

    async def start(self):
        """Start the browser engine (LightPanda or Chromium)."""
        if self.mode == "lightpanda":
            await self._start_lightpanda()
        else:
            await self._start_chromium()

    async def stop(self):
        """Tear down everything."""
        for ctx in self._active_contexts:
            try:
                await ctx.close()
            except Exception:
                pass
        self._active_contexts.clear()

        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass

        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass

        if self._lp_proc:
            self._stop_lightpanda()

        logger.info("Browser engine stopped")

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, *args):
        await self.stop()

    # ─── LightPanda Mode ────────────────────────────────────────

    async def _start_lightpanda(self):
        """Start LightPanda as CDP server subprocess."""
        if not LP_BINARY.exists():
            raise FileNotFoundError(
                f"LightPanda binary not found at {LP_BINARY}. "
                f"Run: curl -L -o {LP_BINARY} "
                "https://github.com/lightpanda-io/browser/releases/"
                "download/nightly/lightpanda-aarch64-macos && "
                f"chmod +x {LP_BINARY}"
            )

        # Kill any existing LP process on the port
        self._kill_existing_lp()

        cmd = [
            str(LP_BINARY), "serve",
            "--host", CDP_HOST,
            "--port", str(CDP_PORT),
            "--log-format", "logfmt",
            "--log-level", "warn",
        ]

        # Proxy support
        proxy_url = self._get_proxy_url()
        if proxy_url:
            cmd += ["--http-proxy", proxy_url]
            logger.info(f"LightPanda proxy: {proxy_url}")

        env = {**os.environ, "LIGHTPANDA_DISABLE_TELEMETRY": "true"}
        self._lp_proc = subprocess.Popen(
            cmd, env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        logger.info(f"🐼 LightPanda started (PID {self._lp_proc.pid})")

        # Wait for CDP to be ready
        await self._wait_cdp_ready()

        # Connect Playwright over CDP
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.connect_over_cdp(CDP_ENDPOINT)
        logger.info(f"🐼 Playwright connected to LightPanda at {CDP_ENDPOINT}")

    async def _wait_cdp_ready(self, timeout: int = 15):
        """Poll until LightPanda's CDP server is responding."""
        async with httpx.AsyncClient() as client:
            for i in range(timeout * 10):
                try:
                    r = await client.get(f"{CDP_ENDPOINT}/json/version")
                    if r.status_code == 200:
                        version = r.json().get("Browser", "unknown")
                        logger.info(f"🐼 CDP ready — {version}")
                        return
                except Exception:
                    pass

                # Check if process died
                if self._lp_proc and self._lp_proc.poll() is not None:
                    stderr = self._lp_proc.stderr.read().decode() if self._lp_proc.stderr else ""
                    raise RuntimeError(
                        f"LightPanda exited with code {self._lp_proc.returncode}: {stderr}"
                    )

                await asyncio.sleep(0.1)

        raise RuntimeError(f"LightPanda CDP did not respond within {timeout}s")

    def _stop_lightpanda(self):
        """Kill the LightPanda subprocess."""
        if self._lp_proc:
            try:
                self._lp_proc.terminate()
                self._lp_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._lp_proc.kill()
            logger.info(f"🐼 LightPanda stopped (PID {self._lp_proc.pid})")
            self._lp_proc = None

    def _kill_existing_lp(self):
        """Kill any existing LightPanda process on our port."""
        try:
            subprocess.run(
                ["pkill", "-f", f"lightpanda serve.*--port {CDP_PORT}"],
                capture_output=True, timeout=3,
            )
        except Exception:
            pass

    # ─── Chromium Mode (fallback) ───────────────────────────────

    async def _start_chromium(self):
        """Launch Chromium directly via Playwright."""
        self._playwright = await async_playwright().start()

        launch_args = {
            "headless": self.config.get("headless", True),
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
            ],
        }

        proxy_url = self._get_proxy_url()
        if proxy_url:
            launch_args["proxy"] = {"server": proxy_url}

        self._browser = await self._playwright.chromium.launch(**launch_args)
        logger.info("🌐 Chromium engine started (stealth mode)")

    # ─── Context Creation ───────────────────────────────────────

    @asynccontextmanager
    async def new_context(
        self,
        locale: str = "en-US",
        timezone_id: str = "America/New_York",
        user_agent: str = None,
        extra_headers: dict = None,
    ):
        """
        Create a browser context with neutral locale defaults.
        Works with both LightPanda and Chromium backends.
        """
        ctx_kwargs = {
            "user_agent": user_agent or NEUTRAL_USER_AGENT,
            "viewport": self.config.get("viewport", {"width": 1920, "height": 1080}),
            "java_script_enabled": True,
            "ignore_https_errors": True,
            "extra_http_headers": extra_headers or NEUTRAL_HEADERS,
        }

        # LightPanda doesn't support Emulation.setLocaleOverride / setTimezoneOverride
        if self.mode != "lightpanda":
            ctx_kwargs["locale"] = locale
            ctx_kwargs["timezone_id"] = timezone_id

        ctx = await self._browser.new_context(**ctx_kwargs)

        # Stealth scripts for Chromium mode
        if self.mode == "chromium":
            await ctx.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                window.chrome = {
                    runtime: {},
                    loadTimes: function() {},
                    csi: function() {},
                    app: {},
                };
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
                );
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                delete navigator.__proto__.webdriver;
            """)

        self._active_contexts.append(ctx)
        try:
            yield ctx
        finally:
            self._active_contexts.remove(ctx)
            try:
                await ctx.close()
            except Exception:
                pass

    @asynccontextmanager
    async def new_page(self, **ctx_kwargs):
        """
        Convenience: get a single page directly.
        Usage:
            async with browser_manager.new_page() as page:
                await page.goto("https://...")
        """
        async with self.new_context(**ctx_kwargs) as ctx:
            page = await ctx.new_page()
            timeout = self.config.get("timeout_ms", 30000)
            page.set_default_timeout(timeout)
            page.set_default_navigation_timeout(timeout)
            yield page

    # ─── Helpers ────────────────────────────────────────────────

    def _get_proxy_url(self) -> Optional[str]:
        """Extract proxy URL from config."""
        if not self.proxy_config.get("enabled"):
            return None

        pool = self.proxy_config.get("pool", [])
        if pool:
            return random.choice(pool)

        creds = self.proxy_config.get("credentials", {})
        if creds.get("host"):
            host = creds["host"]
            port = creds.get("port", 8080)
            user = creds.get("username", "")
            pw = creds.get("password", "")
            if user:
                return f"http://{user}:{pw}@{host}:{port}"
            return f"http://{host}:{port}"

        return None

    @property
    def endpoint(self) -> str:
        """HTTP endpoint for the CDP server."""
        return CDP_ENDPOINT

    @property
    def is_lightpanda(self) -> bool:
        return self.mode == "lightpanda"
