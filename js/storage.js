// ═══════════════════════════════════════════════
// STORAGE — delegates to STORAGE_ADAPTER (IndexedDB)
//
// Thin async wrapper so callers can optionally await.
// Must load AFTER storage-adapter.js (depends on window.STORAGE_ADAPTER).
//
// Usage:
//   await Storage.safeSetItem(key, value)  → Promise<boolean>
//   await Storage.safeGetItem(key)         → Promise<value|null>
//   await Storage.safeRemoveItem(key)      → Promise<boolean>
// ═══════════════════════════════════════════════
const Storage = {
  async safeSetItem(key, value) {
    try {
      return await window.STORAGE_ADAPTER.set(key, value);
    } catch (e) {
      console.warn(`[Storage] set failed for "${key}":`, e?.message || e);
      return false;
    }
  },

  async safeGetItem(key) {
    try {
      return await window.STORAGE_ADAPTER.get(key);
    } catch (e) {
      console.warn(`[Storage] get failed for "${key}":`, e?.message || e);
      return null;
    }
  },

  async safeRemoveItem(key) {
    try {
      return await window.STORAGE_ADAPTER.remove(key);
    } catch (e) {
      console.warn(`[Storage] remove failed for "${key}":`, e?.message || e);
      return false;
    }
  },

  async safeClear() {
    try {
      return await window.STORAGE_ADAPTER.clear();
    } catch (e) {
      console.warn(`[Storage] clear failed:`, e?.message || e);
      return false;
    }
  },

  getState() {
    try {
      return window.STORAGE_ADAPTER.getState();
    } catch {
      return { ready: false, error: 'STORAGE_ADAPTER unavailable' };
    }
  }
};

// Expose to window for cross-module access (bare-metal, no modules)
window.Storage = Storage;

// ── Module Contract ────────────────────────────────────────────────
if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Storage', {
    provides: ['safeSetItem', 'safeGetItem', 'safeRemoveItem', 'safeClear', 'getState'],
    requires: ['STORAGE_ADAPTER'],
  });
}
