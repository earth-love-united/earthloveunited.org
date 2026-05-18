"""
═══════════════════════════════════════════════════════════════════════════
  RATE LIMITER — Humanized Request Throttling
  Prevents detection by adding natural delays with jitter.
═══════════════════════════════════════════════════════════════════════════
"""

import asyncio
import random
import time
import logging

logger = logging.getLogger("oracle.rate_limiter")


class RateLimiter:
    """
    Adaptive rate limiter with humanized jitter.
    Exponential backoff on errors. Randomized delays to appear human.
    """

    def __init__(self, config: dict):
        rl_config = config.get("rate_limiting", {})
        self.min_delay = rl_config.get("min_delay_sec", 2.0)
        self.max_delay = rl_config.get("max_delay_sec", 7.0)
        self.jitter = rl_config.get("jitter", True)
        self.max_retries = rl_config.get("max_retries", 3)
        self.backoff_factor = rl_config.get("backoff_factor", 2.0)
        self._last_request_time = 0.0
        self._consecutive_errors = 0

    async def wait(self):
        """Wait a humanized amount of time before the next request."""
        base_delay = random.uniform(self.min_delay, self.max_delay)

        # Add extra delay if we've been hitting errors (back off)
        if self._consecutive_errors > 0:
            penalty = self.backoff_factor ** self._consecutive_errors
            base_delay = min(base_delay * penalty, 60.0)  # Cap at 60s

        # Jitter: occasionally take a longer "human" pause
        if self.jitter and random.random() < 0.15:
            base_delay += random.uniform(3.0, 10.0)  # "Reading the page"

        # Ensure minimum gap since last request
        elapsed = time.time() - self._last_request_time
        if elapsed < base_delay:
            await asyncio.sleep(base_delay - elapsed)

        self._last_request_time = time.time()

    def report_success(self):
        """Reset error counter on success."""
        self._consecutive_errors = 0

    def report_error(self):
        """Increment error counter for exponential backoff."""
        self._consecutive_errors += 1
        logger.warning(
            f"Error #{self._consecutive_errors} — "
            f"{'backing off' if self._consecutive_errors < self.max_retries else 'MAX RETRIES'}"
        )

    @property
    def should_retry(self) -> bool:
        return self._consecutive_errors < self.max_retries
