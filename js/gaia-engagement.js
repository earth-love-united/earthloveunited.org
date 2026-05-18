/**
 * GAIA ENGAGEMENT ENGINE v1.0
 * Scoring, mood detection, idle tracking, quest progress
 * Drives GAIA's behavioral decisions
 */

const GAIA_ENGAGEMENT = (() => {
  // ── Signal weights ──
  const SIGNALS = {
    site_tap: 10, data_reveal: 5, ndvi_explore: 3, climate_view: 4,
    sandbox_open: 5, scenario_run: 15, big_scenario: 10, negative_scenario: 5,
    insight: 8, quest_done: 25, site_complete: 20, all_sites: 30,
    share: 30, return_visit: 20, time_minute: 3, chat_sent: 5,
    chat_received: 2, prediction: 7, correct_prediction: 12,
    idle_penalty: -2,
  };

  // ── Tier thresholds ──
  const TIERS = [
    { max: 10, name: 'COLD', posture: 'Welcoming, mysterious, inviting' },
    { max: 30, name: 'WARM', posture: 'Encouraging, teasing, revealing' },
    { max: 60, name: 'ENGAGED', posture: 'Challenging, deeper content, first key hints' },
    { max: 100, name: 'HOOKED', posture: 'Direct key asks, complex scenarios, personal' },
    { max: 150, name: 'INVESTED', posture: 'Urgent key asks, exclusive reveals, emotional' },
    { max: Infinity, name: 'COMMITTED', posture: 'Full key plea, then post-unlock deep dive' },
  ];

  // ── State ──
  let score = 0;
  let velocityWindow = []; // { timestamp, score }
  let moodSignals = { curiosity: 0, excitement: 0, concern: 0, pride: 0, mystery: 0, warmth: 0, urgency: 0, fierceness: 0 };
  let lastInteraction = Date.now();
  let idleNudgeFired = { GENTLE: false, MEDIUM: false, STRONG: false };

  // ── Per-site state ──
  const siteEngagement = {
    sri_lanka: { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
    antalya: { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
    benin: { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
    borneo: { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  };

  // ── Score ──
  function addSignal(signalName, siteId) {
    const weight = SIGNALS[signalName] || 0;
    score = Math.max(0, score + weight);
    velocityWindow.push({ ts: Date.now(), score });
    // Keep only last 60 seconds for velocity
    const cutoff = Date.now() - 60000;
    velocityWindow = velocityWindow.filter(v => v.ts > cutoff);
    lastInteraction = Date.now();
    // Reset idle nudge flags on interaction
    idleNudgeFired = { GENTLE: false, MEDIUM: false, STRONG: false };
    // Track per-site
    if (siteId && siteEngagement[siteId]) {
      siteEngagement[siteId].xp += weight;
      siteEngagement[siteId].visited = true;
    }
    // Auto-persist on meaningful signals
    if (Math.abs(weight) >= 5) save();
  }

  function getTier() {
    for (const t of TIERS) {
      if (score < t.max) return t;
    }
    return TIERS[TIERS.length - 1];
  }

  function getVelocity() {
    if (velocityWindow.length < 2) return 0;
    const oldest = velocityWindow[0];
    const newest = velocityWindow[velocityWindow.length - 1];
    const dt = (newest.ts - oldest.ts) / 1000;
    if (dt === 0) return 0;
    return (newest.score - oldest.score) / dt;
  }

  // ── Mood ──
  function addMoodSignal(mood) {
    if (moodSignals[mood] !== undefined) moodSignals[mood]++;
  }

  function getMood() {
    let maxMood = 'curiosity', maxVal = 0;
    for (const [m, v] of Object.entries(moodSignals)) {
      if (v > maxVal) { maxMood = m; maxVal = v; }
    }
    return maxMood;
  }

  function getMoodIntensity() {
    const max = Math.max(...Object.values(moodSignals), 1);
    if (max <= 3) return 'subtle';
    if (max <= 6) return 'clear';
    return 'overwhelming';
  }

  // ── Idle detection ──
  function getIdleLevel() {
    const idle = (Date.now() - lastInteraction) / 1000;
    if (idle < 10) return null;
    if (idle < 20) return 'GENTLE';
    if (idle < 40) return 'MEDIUM';
    return 'STRONG';
  }

  function shouldFireIdleNudge() {
    const level = getIdleLevel();
    if (!level) return null;
    if (idleNudgeFired[level]) return null;
    idleNudgeFired[level] = true;
    return level;
  }

  // ── Persistence ──
  function save() {
    try {
      localStorage.setItem('gaia_engagement', JSON.stringify({
        score, moodSignals, lastInteraction, siteEngagement,
        savedAt: Date.now(),
      }));
    } catch { /* ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem('gaia_engagement');
      if (!raw) return;
      const data = JSON.parse(raw);
      score = data.score || 0;
      moodSignals = data.moodSignals || moodSignals;
      if (data.siteEngagement) {
        Object.assign(siteEngagement, data.siteEngagement);
      }
    } catch { /* ignore */ }
  }

  // ── Init ──
  load();
  // Periodic auto-save (every 30s) + save on page unload
  setInterval(save, 30000);
  try { window.addEventListener('beforeunload', save); } catch { /* ignore */ }

  return {
    addSignal, addMoodSignal,
    getScore: () => score,
    getTier,
    getVelocity,
    getMood, getMoodIntensity,
    getIdleLevel, shouldFireIdleNudge,
    getSiteEngagement: () => siteEngagement,
    interact: () => { lastInteraction = Date.now(); },
    save, load,
  };
})();
