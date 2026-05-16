/**
 * GAIA JOURNAL & QUESTS v1.0
 * Persistent insight collection + 16 quests across 4 tiers
 */

const GAIA_JOURNAL = (() => {
  // ── Quest definitions ──
  const QUESTS = [
    // Tier 1: Explorer (0-30)
    { id: 'visit_all_sites', title: 'See All Wounds', desc: 'Visit all 4 project sites', tier: 1, target: 4, signal: 'site_tap' },
    { id: 'first_scenario', title: 'First Decision', desc: 'Run your first restoration scenario', tier: 1, target: 1, signal: 'scenario_run' },
    { id: 'first_prediction', title: 'Trust Your Gut', desc: 'Make a prediction before seeing data', tier: 1, target: 1, signal: 'prediction' },
    { id: 'collect_3_insights', title: 'Curious Mind', desc: 'Collect 3 insights in your journal', tier: 1, target: 3, signal: 'insight' },

    // Tier 2: Investigator (30-60)
    { id: 'explore_all_layers', title: 'Dig Deeper', desc: 'Reveal all data layers at any site', tier: 2, target: 5, signal: 'data_reveal' },
    { id: 'run_3_scenarios', title: 'What If...', desc: 'Run 3 different restoration scenarios', tier: 2, target: 3, signal: 'scenario_run' },
    { id: 'correct_prediction', title: 'Sharp Eye', desc: 'Make a correct prediction', tier: 2, target: 1, signal: 'correct_prediction' },
    { id: 'big_scenario', title: 'Think Big', desc: 'Run a scenario that sequesters >1M tCO₂', tier: 2, target: 1, signal: 'big_scenario' },

    // Tier 3: Scientist (60-100)
    { id: 'visit_borneo', title: 'The Green Lie', desc: 'Discover Borneo\'s secret', tier: 3, target: 1, signal: 'site_tap', site: 'borneo' },
    { id: 'visit_benin', title: 'Homecoming', desc: 'Learn about Jean\'s legacy', tier: 3, target: 1, signal: 'site_tap', site: 'benin' },
    { id: 'negative_scenario', title: 'Feel the Weight', desc: 'Run a scenario that releases carbon', tier: 3, target: 1, signal: 'negative_scenario' },
    { id: 'collect_8_insights', title: 'Field Journal', desc: 'Collect 8 insights', tier: 3, target: 8, signal: 'insight' },

    // Tier 4: Guardian (100+)
    { id: 'complete_all_sites', title: 'Witness', desc: 'Fully explore all 4 sites', tier: 4, target: 4, signal: 'site_complete' },
    { id: 'run_10_scenarios', title: 'Restoration Master', desc: 'Run 10 scenarios', tier: 4, target: 10, signal: 'scenario_run' },
    { id: 'collect_12_insights', title: 'Deep Knowledge', desc: 'Collect 12 insights', tier: 4, target: 12, signal: 'insight' },
    { id: 'share_journal', title: 'Spread the Word', desc: 'Share your journal', tier: 4, target: 1, signal: 'share' },
  ];

  // ── State ──
  let entries = []; // { text, siteId, timestamp, questId }
  let questProgress = {}; // questId -> count
  let completedQuests = [];

  // ── Persistence ──
  function save() {
    try {
      localStorage.setItem('gaia_journal', JSON.stringify({
        entries, questProgress, completedQuests, savedAt: Date.now(),
      }));
    } catch { /* ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem('gaia_journal');
      if (!raw) return;
      const data = JSON.parse(raw);
      entries = data.entries || [];
      questProgress = data.questProgress || {};
      completedQuests = data.completedQuests || [];
    } catch { /* ignore */ }
  }

  // ── Journal ──
  function addEntry(text, siteId, questId) {
    entries.push({ text, siteId, timestamp: Date.now(), questId });
    save();

    // Trigger pledge prompt after collecting 3+ insights
    if (typeof PLEDGE_WALL !== 'undefined') {
      PLEDGE_WALL.onInsightsCollected(entries.length);
    }
  }

  function getEntries() { return entries; }
  function getEntryCount() { return entries.length; }

  // ── Quests ──
  function checkQuestProgress(signalName, siteId) {
    const newlyCompleted = [];
    for (const quest of QUESTS) {
      if (completedQuests.includes(quest.id)) continue;
      if (quest.signal !== signalName) continue;
      if (quest.site && quest.site !== siteId) continue;

      questProgress[quest.id] = (questProgress[quest.id] || 0) + 1;

      if (questProgress[quest.id] >= quest.target) {
        completedQuests.push(quest.id);
        newlyCompleted.push(quest);
      }
    }
    if (newlyCompleted.length > 0) save();
    return newlyCompleted;
  }

  function getQuests() {
    return QUESTS.map(q => ({
      ...q,
      progress: questProgress[q.id] || 0,
      completed: completedQuests.includes(q.id),
    }));
  }

  function getCompletedCount() { return completedQuests.length; }
  function getTotalCount() { return QUESTS.length; }

  // ── Share card ──
  function generateShareCard() {
    const tier = completedQuests.length < 4 ? 'Explorer' : completedQuests.length < 8 ? 'Investigator' : completedQuests.length < 12 ? 'Scientist' : 'Guardian';
    return {
      tier,
      insights: entries.length,
      quests: `${completedQuests.length}/${QUESTS.length}`,
      sites: [...new Set(entries.map(e => e.siteId))].length,
    };
  }

  // ── Init ──
  load();

  return {
    addEntry, getEntries, getEntryCount,
    checkQuestProgress, getQuests, getCompletedCount, getTotalCount,
    generateShareCard,
    save, load,
  };
})();
