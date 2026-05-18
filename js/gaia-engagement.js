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

  // ── Participant model ──
  const participantModel = {
    analytical: 0, intuitive: 0, emotional: 0, social: 0,
    asksQuestions: 0, makesPredictions: 0, correctPredictions: 0,
    exploresDeep: 0, sharesResults: 0, returnsVisit: 0,
  };

  // ── Knowledge model ──
  const knowledgeModel = {
    understandsCarbonCycle: 0,
    understandsBiomes: 0,
    understandsFire: 0,
    understandsRestoration: 0,
    understandsTippingPoints: 0,
  };

  // ── Score ──
  function addSignal(signalName, siteId) {
    const weight = SIGNALS[signalName] || 0;
    score = Math.max(0, score + weight);
    velocityWindow.push({ ts: Date.now(), score });
    const cutoff = Date.now() - 60000;
    velocityWindow = velocityWindow.filter(v => v.ts > cutoff);
    lastInteraction = Date.now();
    idleNudgeFired = { GENTLE: false, MEDIUM: false, STRONG: false };
    // Track per-site
    if (siteId && siteEngagement[siteId]) {
      siteEngagement[siteId].xp += weight;
      siteEngagement[siteId].visited = true;
      if (signalName === 'data_reveal') siteEngagement[siteId].layersRevealed++;
      if (signalName === 'scenario_run') siteEngagement[siteId].scenariosRun++;
    }
    // Update participant model
    updateParticipantModel(signalName);
    // Update knowledge model
    updateKnowledgeModel(signalName, siteId);
    // Feed GaiaMind emotional events
    if (typeof GaiaMind !== 'undefined') {
      const emotionMap = {
        site_tap: ['curious', 1, 'User explored a site'],
        data_reveal: ['curious', 2, 'User revealed data'],
        scenario_run: ['excited', 2, 'User ran a scenario'],
        big_scenario: ['proud', 3, 'User made a big impact'],
        negative_scenario: ['concerned', 2, 'User saw carbon release'],
        insight: ['warm', 2, 'User collected an insight'],
        correct_prediction: ['proud', 2, 'User predicted correctly'],
        share: ['excited', 3, 'User shared'],
        return_visit: ['warm', 2, 'User returned'],
      };
      const [emotion, intensity, cause] = emotionMap[signalName] || [];
      if (emotion) GaiaMind.addEmotionalEvent(emotion, intensity, cause, siteId);
    }
    if (Math.abs(weight) >= 5) save();
  }

  function updateParticipantModel(signalName) {
    const p = participantModel;
    switch (signalName) {
      case 'data_reveal': case 'ndvi_explore': case 'climate_view':
        p.analytical += 2; p.asksQuestions++; break;
      case 'prediction': p.makesPredictions++; p.intuitive += 2; break;
      case 'correct_prediction': p.correctPredictions++; p.analytical += 1; break;
      case 'insight': p.emotional += 2; p.exploresDeep++; break;
      case 'share': p.social += 3; p.sharesResults++; break;
      case 'return_visit': p.returnsVisit++; break;
      case 'scenario_run': p.intuitive += 1; break;
      case 'site_complete': p.exploresDeep += 2; break;
    }
  }

  function updateKnowledgeModel(signalName, siteId) {
    const k = knowledgeModel;
    switch (signalName) {
      case 'data_reveal':
        if (siteId === 'borneo') k.understandsCarbonCycle += 2;
        if (siteId === 'antalya') k.understandsFire += 2;
        if (siteId === 'benin') k.understandsRestoration += 2;
        if (siteId === 'sri_lanka') k.understandsRestoration += 2;
        break;
      case 'scenario_run': k.understandsTippingPoints += 1; break;
      case 'insight':
        k.understandsCarbonCycle += 1;
        k.understandsBiomes += 1;
        break;
    }
  }

  function getArchetype() {
    const p = participantModel;
    const scores = {
      analyst: p.analytical + p.asksQuestions * 2 + p.correctPredictions * 3,
      explorer: p.intuitive + p.exploresDeep * 2 + p.makesPredictions,
      empath: p.emotional * 2 + p.returnsVisit * 3,
      skeptic: p.makesPredictions > 2 ? p.analytical + p.asksQuestions : 0,
      sharer: p.social + p.sharesResults * 3,
    };
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0][1] > 0 ? sorted[0][0] : 'explorer';
  }

  function getSiteStates() {
    const states = {};
    for (const [id, s] of Object.entries(siteEngagement)) {
      states[id] = {
        state: s.xp >= 100 ? 'mastered' : s.xp >= 50 ? 'explored' : s.xp >= 10 ? 'available' : 'locked',
        xp: s.xp,
        visited: s.visited,
        layersRevealed: s.layersRevealed,
        scenariosRun: s.scenariosRun,
      };
    }
    return states;
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
    Storage.safeSetItem('gaia_engagement', JSON.stringify({
      score, moodSignals, lastInteraction, siteEngagement,
      participantModel, knowledgeModel,
      savedAt: Date.now(),
    }));
  }

  function load() {
    try {
      const raw = Storage.safeGetItem('gaia_engagement');
      if (!raw) return;
      const data = JSON.parse(raw);
      score = data.score || 0;
      moodSignals = data.moodSignals || moodSignals;
      if (data.siteEngagement) Object.assign(siteEngagement, data.siteEngagement);
      if (data.participantModel) Object.assign(participantModel, data.participantModel);
      if (data.knowledgeModel) Object.assign(knowledgeModel, data.knowledgeModel);
    } catch { /* ignore */ }
  }

  // ── Init ──
  load();
  // Load GaiaMind state if available
  if (typeof GaiaMind !== 'undefined') {
    try {
      const mindData = Storage.safeGetItem('gaia_mind');
      if (mindData) GaiaMind.deserialize(mindData);
    } catch { /* ignore */ }
    // Decay emotions based on time since last visit
    const lastVisit = GaiaMind.getTimeSinceLastVisit?.();
    if (lastVisit && lastVisit > 0) {
      const daysSince = lastVisit / (1000 * 60 * 60 * 24);
      if (daysSince > 0.1) GaiaMind.decayEmotions(daysSince);
    }
    // Record this session
    if (GaiaMind.recordSession) {
      GaiaMind.recordSession({
        sitesVisited: [],
        dominantEmotion: GaiaMind.getDominantEmotion?.()?.emotion || 'curious',
        keyInsight: null,
        gaiaEmotion: 'curious',
        leftOff: 'arrival',
        duration: 0,
        score: 0,
      });
    }
  }
  // Periodic auto-save (every 30s) + save on page unload
  setInterval(save, 30000);
  try { window.addEventListener('beforeunload', save); } catch { /* ignore */ }
  // Also save GaiaMind periodically
  setInterval(() => {
    if (typeof GaiaMind !== 'undefined') {
      try { Storage.safeSetItem('gaia_mind', GaiaMind.serialize()); } catch { /* ignore */ }
    }
  }, 30000);
  try { window.addEventListener('beforeunload', () => { if (typeof GaiaMind !== 'undefined') { try { Storage.safeSetItem('gaia_mind', GaiaMind.serialize()); } catch { /* ignore */ } } }); } catch { /* ignore */ }

  return {
    addSignal, addMoodSignal,
    getScore: () => score,
    getTier,
    getVelocity,
    getMood, getMoodIntensity,
    getIdleLevel, shouldFireIdleNudge,
    getSiteEngagement: () => siteEngagement,
    getSiteStates,
    getArchetype,
    getParticipantModel: () => ({ ...participantModel }),
    getKnowledgeModel: () => ({ ...knowledgeModel }),
    interact: () => { lastInteraction = Date.now(); },
    save, load,
  };
})();
