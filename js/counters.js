// ═══════════════════════════════════════════════
// COUNTERS — Animated number counters
// ═══════════════════════════════════════════════

const Counters = {
  animated: false,

  animate() {
    if (this.animated) return;
    this.animated = true;
    this.animateNum('counter-absorb', 0, 123, 1500, '');
    this.animateNum('counter-emit', 0, 143, 1800, '');
    setTimeout(() => this.animateNum('counter-gap', 0, 20, 800, ''), 1200);
  },

  animateNum(id, from, to, duration, suffix) {
    const el = $(id);
    if (!el) return;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
};

window.Counters = Counters;

  MODULE_CONTRACTS.register('Counters', {
    provides: ['init', 'increment', 'getCount', 'reset'],
    requires: [],
  });
