// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA QUEST SYSTEM v2.0 — Adapter Layer
// Delegates to GAIA_JOURNAL as the canonical quest engine.
// Preserves the GaiaQuests API surface for gaia-client.js compatibility.
//
// Previously: independent quest system with its own storage.
// Now: thin adapter that translates API calls to GAIA_JOURNAL.
// ═══════════════════════════════════════════════════════

const GaiaQuests = (() => {

  let _listeners = [];
  let _migrated = false;

  function init() {
    // Migrate any legacy gaia_quests progress into GAIA_JOURNAL
    if (!_migrated) {
      _migrateLegacyProgress();
      _migrated = true;
    }
  }

  /**
   * One-time migration: if user has progress in old 'gaia_quests' key,
   * merge it into GAIA_JOURNAL's storage by firing equivalent signals.
   */
  function _migrateLegacyProgress() {
    if (typeof Storage === 'undefined') return;
    try {
      const raw = Storage.safeGetItem('gaia_quests');
      if (!raw) return;
      const oldProgress = JSON.parse(raw);
      if (!oldProgress || typeof oldProgress !== 'object') return;

      console.log('[GaiaQuests] Migrating legacy quest progress to GAIA_JOURNAL...');
      let migrated = 0;

      for (const [questId, data] of Object.entries(oldProgress)) {
        if (!data || typeof data !== 'object') continue;
        if (data.status === 'completed' && typeof GAIA_JOURNAL !== 'undefined') {
          // Fire the signal enough times to complete the quest
          // This works because checkQuestProgress is idempotent for completed quests
          const progress = data.progress || {};
          for (const [key, count] of Object.entries(progress)) {
            // key format: "signal_type" or "signal_type_siteId"
            const parts = key.split('_');
            const signal = parts.slice(0, -1).join('_') || key;
            for (let i = 0; i < count; i++) {
              GAIA_JOURNAL.checkQuestProgress(signal, null);
            }
          }
          migrated++;
        }
      }

      if (migrated > 0) {
        console.log(`[GaiaQuests] Migrated ${migrated} completed quests.`);
        GAIA_JOURNAL.save();
      }

      // Clean up legacy key (keep a backup just in case)
      Storage.safeSetItem('gaia_quests_v1_backup', raw);
      Storage.safeRemoveItem('gaia_quests');
    } catch (e) {
      console.warn('[GaiaQuests] Migration failed:', e.message);
    }
  }

  // ── Adapter methods — delegate to GAIA_JOURNAL ──

  function getQuest(questId) {
    if (typeof GAIA_JOURNAL === 'undefined') return null;
    const quests = GAIA_JOURNAL.getQuests();
    return quests.find(q => q.id === questId) || null;
  }

  function getAllQuests() {
    if (typeof GAIA_JOURNAL === 'undefined') return [];
    return GAIA_JOURNAL.getQuests().map(q => ({
      id: q.id,
      tier: _tierName(q.tier),
      title: q.title,
      description: q.desc,
      icon: q.icon || '🌱',
      hidden: q.hidden || false,
      status: q.completed ? 'completed' : q.progress > 0 ? 'in_progress' : 'available',
      currentProgress: { [q.signal]: q.progress },
      objectives: [{ type: q.signal, target: q.target, site_id: q.site }],
    }));
  }

  function getActiveQuests() {
    return getAllQuests().filter(q => q.status === 'in_progress' || q.status === 'available');
  }

  function getCompletedQuests() {
    return getAllQuests().filter(q => q.status === 'completed');
  }

  function updateProgress(questId, eventType, context = {}) {
    if (typeof GAIA_JOURNAL === 'undefined') return { updated: false };
    const results = GAIA_JOURNAL.checkQuestProgress(eventType, context.siteId);
    const wasUpdated = results.some(q => q.id === questId);
    if (wasUpdated) {
      _listeners.forEach(fn => fn({ type: 'quest_complete', questId }));
    }
    return { updated: true, questId, status: wasUpdated ? 'completed' : 'in_progress', isComplete: wasUpdated };
  }

  function checkAllQuests(eventType, context) {
    if (typeof GAIA_JOURNAL === 'undefined') return [];
    const results = GAIA_JOURNAL.checkQuestProgress(eventType, context?.siteId);
    if (results.length > 0) {
      _listeners.forEach(fn => fn({ type: 'quest_update' }));
    }
    return results.map(q => ({ updated: true, questId: q.id, status: 'completed', isComplete: true }));
  }

  function getStats() {
    if (typeof GAIA_JOURNAL === 'undefined') return { total: 0, completed: 0 };
    return { total: GAIA_JOURNAL.getTotalCount(), completed: GAIA_JOURNAL.getCompletedCount() };
  }

  function resetAll() {
    if (typeof GAIA_JOURNAL !== 'undefined') {
      // Reset journal quest progress (preserves journal entries)
      // GAIA_JOURNAL doesn't expose a reset — this is intentional (progress is precious)
    }
    Storage.safeRemoveItem('gaia_quests');
    Storage.safeRemoveItem('gaia_quests_v1_backup');
  }

  function onQuestEvent(fn) { _listeners.push(fn); }

  function _tierName(tier) {
    const names = { 1: 'SEED', 2: 'GROW', 3: 'FLOURISH', 4: 'GUARDIAN' };
    return names[tier] || 'SEED';
  }

  return {
    init, getQuest, getAllQuests, getActiveQuests, getCompletedQuests,
    updateProgress, checkAllQuests, getStats, resetAll, onQuestEvent,
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaQuests;
if (typeof window !== 'undefined') window.GaiaQuests = GaiaQuests;
