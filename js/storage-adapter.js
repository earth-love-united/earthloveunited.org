/**
 * STORAGE_ADAPTER — IndexedDB Asynchronous Storage Layer
 *
 * Zero-dependency IndexedDB wrapper for frontier datasets.
 * Replaces localStorage for payloads exceeding the ~5MB limit.
 *
 * Promise-based API: get, set, remove, clear.
 * Exposes SML lifecycle: init, reset, destroy, getState.
 *
 * Contract: STORAGE_ADAPTER
 * Requires: gaia-utils (for reportError)
 *
 * @version 1.0.0
 * @date May 27 2026
 */
const STORAGE_ADAPTER = (() => {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────
  const DB_NAME = 'ELU_Storage';
  const DB_VERSION = 1;
  const STORE_NAME = 'keyvalue';
  const DB_KEY_PATH = 'key';

  // ── State ──────────────────────────────────────────────────────
  let _db = null;
  let _ready = false;
  let _readyPromise = null;
  let _readyResolve = null;
  let _readyReject = null;
  let _dbName = DB_NAME;
  let _dbVersion = DB_VERSION;
  let _storeName = STORE_NAME;

  // ── Internal: Open / Upgrade ───────────────────────────────────
  function _openDB() {
    if (_readyPromise) return _readyPromise;

    _readyPromise = new Promise((resolve, reject) => {
      _readyResolve = resolve;
      _readyReject = reject;

      if (!window.indexedDB) {
        const err = new Error('IndexedDB not supported in this browser');
        reportError('STORAGE_ADAPTER._openDB', err);
        _ready = false;
        _readyReject(err);
        return;
      }

      const request = window.indexedDB.open(_dbName, _dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Create or recreate the object store on version change
        if (oldVersion < 1) {
          if (db.objectStoreNames.contains(_storeName)) {
            db.deleteObjectStore(_storeName);
          }
          const store = db.createObjectStore(_storeName, { keyPath: DB_KEY_PATH });
          // Index for fast key lookups (redundant with keyPath but explicit)
          store.createIndex('key_idx', DB_KEY_PATH, { unique: true });
        }

        // Future version upgrades go here:
        // if (oldVersion < 2) { ... }
        // if (oldVersion < 3) { ... }
      };

      request.onsuccess = (event) => {
        _db = event.target.result;
        _ready = true;

        // Handle unexpected DB closure (e.g. user clears data in devtools)
        _db.onclose = () => {
          _ready = false;
          _db = null;
          _readyPromise = null;
          reportWarn('STORAGE_ADAPTER', 'Database connection closed unexpectedly');
        };

        // Handle version change from another tab
        _db.onversionchange = () => {
          _db.close();
          _ready = false;
          _db = null;
          _readyPromise = null;
          reportWarn('STORAGE_ADAPTER', 'Database version changed in another tab — connection closed');
        };

        _readyResolve(_db);
      };

      request.onerror = (event) => {
        const err = event.target.error || new Error('Unknown IndexedDB open error');
        reportError('STORAGE_ADAPTER._openDB', err);
        _ready = false;
        _readyReject(err);
      };

      request.onblocked = () => {
        const err = new Error('IndexedDB open blocked — other connections must close first');
        reportWarn('STORAGE_ADAPTER', err.message);
        // Don't reject — the onupgradeneeded in other tabs may resolve
      };
    });

    return _readyPromise;
  }

  // ── Internal: Get a transaction + store ────────────────────────
  function _getStore(mode = 'readonly') {
    if (!_db) {
      return Promise.reject(new Error('STORAGE_ADAPTER: Database not initialized. Call init() first.'));
    }
    return new Promise((resolve, reject) => {
      try {
        const tx = _db.transaction([_storeName], mode);
        const store = tx.objectStore(_storeName);
        resolve({ tx, store });
      } catch (err) {
        reportError('STORAGE_ADAPTER._getStore', err);
        reject(err);
      }
    });
  }

  // ── Internal: Wrap IDBRequest in Promise ───────────────────────
  function _requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IDBRequest failed'));
    });
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * get(key) → Promise<value|null>
   * Retrieves a value by key. Returns null if not found.
   */
  function get(key) {
    return _openDB().then(() =>
      _getStore('readonly').then(({ store }) =>
        _requestToPromise(store.get(key))
      )
    ).then((result) => {
      if (result === undefined || result === null) return null;
      // result is { key, value } — unwrap
      return result.value !== undefined ? result.value : null;
    }).catch((err) => {
      reportError('STORAGE_ADAPTER.get', err);
      return null;
    });
  }

  /**
   * set(key, value) → Promise<boolean>
   * Stores a key-value pair. Overwrites if key exists.
   * Returns true on success, false on failure.
   */
  function set(key, value) {
    return _openDB().then(() =>
      _getStore('readwrite').then(({ store }) =>
        _requestToPromise(store.put({ key, value }))
      )
    ).then(() => true).catch((err) => {
      reportError('STORAGE_ADAPTER.set', err);
      return false;
    });
  }

  /**
   * remove(key) → Promise<boolean>
   * Deletes a key-value pair. Returns true on success.
   */
  function remove(key) {
    return _openDB().then(() =>
      _getStore('readwrite').then(({ store }) =>
        _requestToPromise(store.delete(key))
      )
    ).then(() => true).catch((err) => {
      reportError('STORAGE_ADAPTER.remove', err);
      return false;
    });
  }

  /**
   * clear() → Promise<boolean>
   * Removes ALL entries from the store.
   */
  function clear() {
    return _openDB().then(() =>
      _getStore('readwrite').then(({ store }) =>
        _requestToPromise(store.clear())
      )
    ).then(() => true).catch((err) => {
      reportError('STORAGE_ADAPTER.clear', err);
      return false;
    });
  }

  /**
   * keys() → Promise<string[]>
   * Returns all keys in the store. Utility for debugging / migration.
   */
  function keys() {
    return _openDB().then(() =>
      _getStore('readonly').then(({ store }) =>
        _requestToPromise(store.getAllKeys())
      )
    ).catch((err) => {
      reportError('STORAGE_ADAPTER.keys', err);
      return [];
    });
  }

  // ── SML Lifecycle ───────────────────────────────────────────────

  /**
   * init(config = {})
   * Opens the DB connection. Must be called before any get/set/remove/clear.
   * Config options:
   *   dbName    — override DB name
   *   dbVersion — override DB version
   *   storeName — override object store name
   */
  function init(config = {}) {
    if (config.dbName) _dbName = config.dbName;
    if (config.dbVersion) _dbVersion = config.dbVersion;
    if (config.storeName) _storeName = config.storeName;

    return _openDB().then((db) => {
      reportWarn('STORAGE_ADAPTER', `Initialized — DB: ${_dbName} v${_dbVersion}, store: ${_storeName}`);
      return db;
    });
  }

  /**
   * reset()
   * Closes the DB, deletes it entirely, then reopens fresh.
   * Destructive — all data is lost.
   */
  function reset() {
    return new Promise((resolve, reject) => {
      // Close existing connection
      if (_db) {
        _db.close();
        _db = null;
      }
      _ready = false;
      _readyPromise = null;

      const delReq = window.indexedDB.deleteDatabase(_dbName);
      delReq.onsuccess = () => {
        reportWarn('STORAGE_ADAPTER', `Database ${_dbName} deleted`);
        // Reopen fresh
        _openDB().then(resolve).catch(reject);
      };
      delReq.onerror = () => {
        const err = delReq.error || new Error('Failed to delete database');
        reportError('STORAGE_ADAPTER.reset', err);
        reject(err);
      };
      delReq.onblocked = () => {
        reportWarn('STORAGE_ADAPTER', 'Delete blocked — close other tabs using this DB');
      };
    });
  }

  /**
   * destroy()
   * Closes the DB connection and resets internal state.
   * Does NOT delete the database — use reset() for that.
   */
  function destroy() {
    if (_db) {
      _db.close();
      _db = null;
    }
    _ready = false;
    _readyPromise = null;
    _readyResolve = null;
    _readyReject = null;
    reportWarn('STORAGE_ADAPTER', 'Destroyed — connection closed');
  }

  /**
   * getState() → { ready, dbName, dbVersion, storeName }
   * Returns current adapter state for debugging.
   */
  function getState() {
    return {
      ready: _ready,
      dbName: _dbName,
      dbVersion: _dbVersion,
      storeName: _storeName,
      dbInstance: _db !== null,
    };
  }

  // ── Exports ─────────────────────────────────────────────────────
  return {
    // Promise API
    get,
    set,
    remove,
    clear,
    keys,

    // SML lifecycle
    init,
    reset,
    destroy,
    getState,
  };
})();

// ── Register on window (required by safeCall / hasModule) ──────────
window.STORAGE_ADAPTER = STORAGE_ADAPTER;

// ── Module Contract ────────────────────────────────────────────────
if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('STORAGE_ADAPTER', {
    provides: ['init', 'reset', 'destroy', 'getState', 'get', 'set', 'remove', 'clear', 'keys'],
    requires: [],
  });
}
