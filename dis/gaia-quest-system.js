// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA QUEST SYSTEM v1.0
// Progression layer — gives structure without feeling like school
// Quests are GAIA's way of saying "there's more to see"
// ═══════════════════════════════════════════════════════

const GaiaQuests = (() => {


  const QUESTS = {
    first_steps: { tier: 'SEED', title: 'First Steps', description: 'Explore your first restoration site.', icon: '🌱', objectives: [{ type: 'site_tap', target: 1 }] },
    carbon_curious: { tier: 'SEED', title: 'Carbon Curious', description: 'Run your first carbon scenario.', icon: '🔬', objectives: [{ type: 'scenario_run', target: 1 }] },
    hello_world: { tier: 'SEED', title: 'Hello, World', description: 'Have 5 exchanges with GAIA.', icon: '💬', objectives: [{ type: 'chat_sent', target: 5 }] },
    four_corners: { tier: 'GROW', title: 'Four Corners', description: 'Explore all four restoration sites.', icon: '🌍', objectives: [{ type: 'site_tap', target: 4 }] },
    detective: { tier: 'GROW', title: 'Detective', description: 'Discover 3 hidden data layers.', icon: '🔍', objectives: [{ type: 'data_reveal', target: 3 }] },
    restorer: { tier: 'GROW', title: 'Restorer', description: 'Build a scenario that sequesters over 1M tons of CO₂.', icon: '🌳', objectives: [{ type: 'big_scenario', target: 1 }] },
    skeptic: { tier: 'GROW', title: 'Skeptic', description: 'Challenge GAIA on something.', icon: '🤔', objectives: [{ type: 'chat_sent_contains', target: 1, keywords: ['but','why','really','disagree','wrong'] }] },
    name_yourself: { tier: 'FLOURISH', title: 'Name Yourself', description: 'Create a profile and save your progress.', icon: '👤', objectives: [{ type: 'profile_created', target: 1 }] },
    field_journal: { tier: 'FLOURISH', title: 'Field Journal', description: 'Collect 10 insights in your journal.', icon: '📓', objectives: [{ type: 'insight', target: 10 }] },
    share_the_world: { tier: 'FLOURISH', title: 'Share the World', description: 'Share your journal or an insight.', icon: '📣', objectives: [{ type: 'share', target: 1 }] },
    green_lie: { tier: 'GROW', title: 'The Green Lie', description: 'Discover why Borneo\'s green appearance is deceiving.', icon: '🕵️', hidden: true, objectives: [{ type: 'site_tap', target: 1, site_id: 'borneo' }, { type: 'data_reveal', target: 1, site_id: 'borneo', layer: 'carbon' }] },
    jeans_legacy: { tier: 'GROW', title: "Jean's Legacy", description: 'Learn about Jean Missinhoun and the Benin restoration.', icon: '💚', hidden: true, objectives: [{ type: 'site_tap', target: 1, site_id: 'benin' }, { type: 'data_reveal', target: 1, site_id: 'benin', layer: 'narrative' }] },
    fire_and_time: { tier: 'GROW', title: 'Fire and Time', description: 'Understand why Antalya\'s recovery takes decades.', icon: '⏳', hidden: true, objectives: [{ type: 'site_tap', target: 1, site_id: 'antalya' }, { type: 'ndvi_scrolled', target: 1, site_id: 'antalya' }] },
    perfect_economy: { tier: 'GROW', title: 'Perfect Economy', description: 'Discover how Sri Lanka\'s restoration pays for itself.', icon: '🌿', hidden: true, objectives: [{ type: 'site_tap', target: 1, site_id: 'sri_lanka' }, { type: 'scenario_run', target: 1, site_id: 'sri_lanka' }] },
  };

  let _progress = {};
  let _listeners = [];

  function init() { _loadProgress(); }

  function _loadProgress() {
    try {
      const raw = Storage.safeGetItem('gaia_quests');
      if (raw) _progress = JSON.parse(raw);
    } catch (e) { _progress = {}; }
  }

  function _saveProgress() {
    try { Storage.safeSetItem('gaia_quests', JSON.stringify(_progress)); } catch (e) {}
  }

  function getQuest(questId) { return QUESTS[questId] || null; }

  function getAllQuests() {
    return Object.entries(QUESTS).map(([id, q]) => ({
      id, ...q,
      status: _progress[questId]?.status || 'locked',
      currentProgress: _progress[questId]?.progress || {}
    }));
  }

  function getActiveQuests() {
    return getAllQuests().filter(q => q.status === 'in_progress' || q.status === 'available');
  }

  function getCompletedQuests() {
    return getAllQuests().filter(q => q.status === 'completed');
  }

  function updateProgress(questId, eventType, context = {}) {
    const quest = QUESTS[questId];
    if (!quest) return { updated: false };
    if (!_progress[questId]) _progress[questId] = { status: 'in_progress', progress: {}, startedAt: Date.now() };
    const qp = _progress[questId];
    for (const obj of quest.objectives) {
      if (obj.type !== eventType) continue;
      if (obj.site_id && context.siteId !== obj.site_id) continue;
      if (obj.layer && context.layer !== obj.layer) continue;
      if (obj.keywords && context.message) {
        if (!obj.keywords.some(k => context.message.toLowerCase().includes(k.toLowerCase()))) continue;
      }
      const key = obj.site_id ? `${obj.type}_${obj.site_id}` : obj.type;
      qp.progress[key] = (qp.progress[key] || 0) + 1;
    }
    const allComplete = quest.objectives.every(obj => {
      const key = obj.site_id ? `${obj.type}_${obj.site_id}` : obj.type;
      return (qp.progress[key] || 0) >= obj.target;
    });
    if (allComplete && qp.status !== 'completed') {
      qp.status = 'completed';
      qp.completedAt = Date.now();
      _listeners.forEach(fn => fn({ type: 'quest_complete', questId, quest }));
    }
    _saveProgress();
    _notifyListeners();
    return { updated: true, questId, status: qp.status, isComplete: allComplete };
  }

  function checkAllQuests(eventType, context) {
    const results = [];
    for (const questId of Object.keys(QUESTS)) {
      if (_progress[questId]?.status === 'completed') continue;
      const result = updateProgress(questId, eventType, context);
      if (result.updated) results.push(result);
    }
    return results;
  }

  function getStats() {
    const all = getAllQuests();
    const completed = all.filter(q => q.status === 'completed');
    return { total: all.length, completed: completed.length };
  }

  function resetAll() {
    _progress = {};
    Storage.safeRemoveItem('gaia_quests');
  }

  function onQuestEvent(fn) { _listeners.push(fn); }

  function _notifyListeners() { _listeners.forEach(fn => fn({ type: 'quest_update' })); }

  return {
    init, getQuest, getAllQuests, getActiveQuests, getCompletedQuests,
    updateProgress, checkAllQuests, getStats, resetAll, onQuestEvent,
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaQuests;
if (typeof window !== 'undefined') window.GaiaQuests = GaiaQuests;
