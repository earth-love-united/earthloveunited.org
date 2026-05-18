"""
═══════════════════════════════════════════════════════════════════════════
  COOKIE MANAGER — Session Persistence for Authenticated Scraping
  
  Handles loading, saving, and injecting browser cookies for sites
  that require authentication (Sahibinden, etc).
  
  Workflow:
    1. Export cookies from your browser (DevTools or extension)
    2. Save as JSON in scrapers/data/<domain>_cookies.json
    3. This module injects them into Playwright contexts
    4. After each scrape, refreshed cookies are saved back
═══════════════════════════════════════════════════════════════════════════
"""

import json
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger("oracle.cookies")

DATA_DIR = Path(__file__).parent.parent / "data"


class CookieManager:
    """Manage persistent cookies for browser contexts."""

    def __init__(self, domain: str):
        self.domain = domain
        self.cookie_path = DATA_DIR / f"{domain}_cookies.json"
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def load(self) -> list[dict]:
        """Load cookies from JSON file."""
        if not self.cookie_path.exists():
            logger.warning(f"No cookie file at {self.cookie_path}")
            return []

        try:
            cookies = json.loads(self.cookie_path.read_text())
            logger.info(f"Loaded {len(cookies)} cookies for {self.domain}")
            return self._normalize_cookies(cookies)
        except Exception as e:
            logger.error(f"Failed to load cookies: {e}")
            return []

    def save(self, cookies: list[dict]):
        """Save cookies to JSON file."""
        try:
            self.cookie_path.write_text(
                json.dumps(cookies, indent=2, ensure_ascii=False)
            )
            logger.info(f"Saved {len(cookies)} cookies for {self.domain}")
        except Exception as e:
            logger.error(f"Failed to save cookies: {e}")

    async def inject(self, context):
        """Inject saved cookies into a Playwright BrowserContext."""
        cookies = self.load()
        if cookies:
            await context.add_cookies(cookies)
            logger.info(f"Injected {len(cookies)} cookies into context")
        return len(cookies) > 0

    async def harvest(self, context):
        """
        Harvest cookies from a Playwright BrowserContext and save.
        Call this after a scrape run to keep sessions alive.
        """
        cookies = await context.cookies()
        if cookies:
            self.save(cookies)
        return cookies

    def _normalize_cookies(self, cookies: list[dict]) -> list[dict]:
        """
        Normalize cookie format from various export sources.
        Handles: DevTools cookieStore.getAll(), EditThisCookie, 
                 Playwright format, and raw key-value pairs.
        """
        normalized = []
        for c in cookies:
            cookie = {}

            # Name & value (required)
            cookie["name"] = c.get("name", c.get("Name", ""))
            cookie["value"] = c.get("value", c.get("Value", ""))
            if not cookie["name"]:
                continue

            # Domain — accept various formats
            domain = c.get("domain", c.get("Domain", f".{self.domain}"))
            if not domain.startswith(".") and not domain.startswith("www"):
                domain = f".{domain}"
            cookie["domain"] = domain

            # Path
            cookie["path"] = c.get("path", c.get("Path", "/"))

            # Optional security flags — must be bool (browser_cookie3 gives int 0/1)
            if "secure" in c or "Secure" in c:
                cookie["secure"] = bool(c.get("secure", c.get("Secure", False)))
            if "httpOnly" in c or "HttpOnly" in c:
                cookie["httpOnly"] = bool(c.get("httpOnly", c.get("HttpOnly", False)))
            if "sameSite" in c or "SameSite" in c:
                ss = c.get("sameSite", c.get("SameSite", "Lax"))
                if ss in ("Strict", "Lax", "None"):
                    cookie["sameSite"] = ss

            # Expiry — playwright wants expires as epoch seconds
            if "expires" in c:
                exp = c["expires"]
                if isinstance(exp, (int, float)) and exp > 0:
                    cookie["expires"] = exp
            elif "expirationDate" in c:  # EditThisCookie format
                cookie["expires"] = c["expirationDate"]

            normalized.append(cookie)

        return normalized

    @property
    def has_cookies(self) -> bool:
        return self.cookie_path.exists()
