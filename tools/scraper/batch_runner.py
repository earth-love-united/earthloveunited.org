"""
═══════════════════════════════════════════════════════════════════════════
  BATCH RUNNER — The Orchestrator
  
  Feed it URLs. It scrapes them all. Survives crashes.
  
  Features:
    - Checkpoint resume: crash at page 3,000, restart from 3,001
    - Concurrent page pool via asyncio.Semaphore
    - Per-URL error tracking with retry
    - Incremental JSONL output (no memory buffering)
    - Progress logging
═══════════════════════════════════════════════════════════════════════════
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Any, Optional

from browser import BrowserManager
from rate_limiter import RateLimiter

logger = logging.getLogger("scraper.batch")


class BatchRunner:
    """
    Resilient batch URL scraper with checkpoint persistence.
    
    Usage:
        runner = BatchRunner(
            urls=["https://...", ...],
            extractor_fn=my_async_extractor,
            output_path="data/scraped/verra_details.jsonl",
            checkpoint_path="data/checkpoints/verra.json",
            config=config,
            concurrency=5,
        )
        await runner.run()
    """

    def __init__(
        self,
        urls: list[str],
        extractor_fn: Callable,
        output_path: str | Path,
        checkpoint_path: str | Path,
        config: dict,
        concurrency: int = 5,
        max_retries: int = 3,
        browser_mode: str = "lightpanda",
    ):
        self.urls = urls
        self.extractor_fn = extractor_fn
        self.output_path = Path(output_path)
        self.checkpoint_path = Path(checkpoint_path)
        self.config = config
        self.concurrency = concurrency
        self.max_retries = max_retries
        self.browser_mode = browser_mode
        self.rate_limiter = RateLimiter(config)

        # State
        self._checkpoint: dict[str, str] = {}
        self._stats = {
            "total": len(urls),
            "done": 0,
            "errors": 0,
            "skipped": 0,
            "start_time": None,
        }

        # Ensure output dirs exist
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

        # Load existing checkpoint
        self._load_checkpoint()

    # ─── Checkpoint Persistence ─────────────────────────────────

    def _load_checkpoint(self):
        """Load checkpoint state from disk."""
        if self.checkpoint_path.exists():
            with open(self.checkpoint_path) as f:
                self._checkpoint = json.load(f)
            done = sum(1 for v in self._checkpoint.values() if v == "done")
            logger.info(f"📋 Checkpoint loaded: {done}/{len(self.urls)} already done")
            self._stats["done"] = done
            self._stats["skipped"] = done

    def _save_checkpoint(self):
        """Persist checkpoint to disk (atomic write)."""
        tmp = self.checkpoint_path.with_suffix(".tmp")
        with open(tmp, "w") as f:
            json.dump(self._checkpoint, f)
        tmp.rename(self.checkpoint_path)

    def _mark(self, url: str, status: str):
        """Mark a URL's status and persist."""
        self._checkpoint[url] = status
        # Save every 10 completions for efficiency
        done = sum(1 for v in self._checkpoint.values() if v == "done")
        if done % 10 == 0:
            self._save_checkpoint()

    @property
    def pending_urls(self) -> list[str]:
        """URLs that haven't been successfully scraped yet."""
        return [u for u in self.urls if self._checkpoint.get(u) != "done"]

    # ─── Core Execution ─────────────────────────────────────────

    async def run(self):
        """Execute the full batch with concurrency control."""
        pending = self.pending_urls
        if not pending:
            logger.info("✅ All URLs already scraped (checkpoint says so)")
            return

        logger.info(
            f"🚀 BatchRunner starting: {len(pending)} pending / "
            f"{len(self.urls)} total (concurrency={self.concurrency})"
        )
        self._stats["start_time"] = time.time()

        sem = asyncio.Semaphore(self.concurrency)

        async with BrowserManager(self.config, mode=self.browser_mode) as bm:
            # Process all pending URLs concurrently (bounded by semaphore)
            tasks = [self._process_url(bm, sem, url) for url in pending]
            await asyncio.gather(*tasks, return_exceptions=True)

        # Final checkpoint save
        self._save_checkpoint()

        # Report
        elapsed = time.time() - self._stats["start_time"]
        done = sum(1 for v in self._checkpoint.values() if v == "done")
        errors = sum(1 for v in self._checkpoint.values() if v.startswith("error"))
        logger.info(
            f"\n{'═' * 60}\n"
            f"  BATCH COMPLETE\n"
            f"  Done: {done} | Errors: {errors} | "
            f"Time: {elapsed:.0f}s ({elapsed/60:.1f}m)\n"
            f"  Output: {self.output_path}\n"
            f"{'═' * 60}"
        )

    async def _process_url(self, bm: BrowserManager, sem: asyncio.Semaphore, url: str):
        """Process a single URL with retry logic."""
        async with sem:
            for attempt in range(1, self.max_retries + 1):
                try:
                    await self.rate_limiter.wait()

                    async with bm.new_page() as page:
                        # Navigate
                        response = await page.goto(
                            url,
                            wait_until="domcontentloaded",
                            timeout=self.config.get("browser", {}).get("timeout_ms", 15000),
                        )

                        if response and response.status >= 400:
                            raise RuntimeError(f"HTTP {response.status}")

                        # Run the extractor function
                        result = await self.extractor_fn(page, url)

                        if result:
                            # Write to JSONL immediately (append mode)
                            self._write_result(result)
                            self._mark(url, "done")
                            self._stats["done"] += 1
                            self.rate_limiter.report_success()

                            # Progress log
                            done = self._stats["done"]
                            total = self._stats["total"]
                            if done % 50 == 0 or done == total:
                                elapsed = time.time() - self._stats["start_time"]
                                rate = done / max(elapsed, 1)
                                eta = (total - done) / max(rate, 0.01)
                                logger.info(
                                    f"📊 Progress: {done}/{total} "
                                    f"({done/total*100:.1f}%) | "
                                    f"{rate:.1f}/s | ETA: {eta:.0f}s"
                                )
                            return

                        else:
                            # Extractor returned None — empty page or no match
                            self._mark(url, "empty")
                            self._stats["done"] += 1
                            return

                except Exception as e:
                    self.rate_limiter.report_error()
                    if attempt < self.max_retries:
                        wait = 2 ** attempt
                        logger.warning(
                            f"⚠️  {url} attempt {attempt}/{self.max_retries} "
                            f"failed: {e}. Retrying in {wait}s..."
                        )
                        await asyncio.sleep(wait)
                    else:
                        error_msg = f"error:{type(e).__name__}:{str(e)[:100]}"
                        self._mark(url, error_msg)
                        self._stats["errors"] += 1
                        logger.error(f"❌ {url} — all retries exhausted: {e}")

    def _write_result(self, result: dict):
        """Append a single result to the output JSONL file."""
        with open(self.output_path, "a") as f:
            f.write(json.dumps(result, ensure_ascii=False) + "\n")

    # ─── Status ─────────────────────────────────────────────────

    def status(self) -> dict:
        """Get current batch status."""
        statuses = {}
        for v in self._checkpoint.values():
            key = v.split(":")[0] if ":" in v else v
            statuses[key] = statuses.get(key, 0) + 1

        return {
            "total": len(self.urls),
            "checkpoint": statuses,
            "pending": len(self.pending_urls),
            "output_file": str(self.output_path),
            "output_lines": self._count_output_lines(),
        }

    def _count_output_lines(self) -> int:
        """Count lines in the output file."""
        if not self.output_path.exists():
            return 0
        with open(self.output_path) as f:
            return sum(1 for _ in f)
