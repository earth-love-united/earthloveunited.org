/**
 * GAIA SIGNALS v2.0
 * Dumb pipe. Stores raw events in IndexedDB via STORAGE_ADAPTER.
 * Both pages write. gaia.html drains on init.
 *
 * index.html modules → GAIA_SIG.emit('site_tap', {siteId}) → IndexedDB
 * gaia-integration.js → GAIA_SIG.drain() → GaiaMind.updateParticipantModel()
 */
const GAIA_SIG = (() => {
  const KEY = 'gaia_signals';
  let _buf = [];

  async function emit(e, p) {
    _buf.push({ e, p: p || {}, t: Date.now() });
    if (_buf.length > 200) _buf = _buf.slice(-200);
    await window.STORAGE_ADAPTER.set(KEY, _buf);
  }

  async function drain() {
    const out = _buf.splice(0);
    await window.STORAGE_ADAPTER.remove(KEY);
    return out;
  }

  async function init() {
    try {
      const stored = await window.STORAGE_ADAPTER.get(KEY);
      if (stored && Array.isArray(stored)) _buf = stored;
    } catch (err) {
      console.warn('[GAIA_SIG] init load failed:', err);
    }
  }

  function reset() { _buf = []; }
  function destroy() { _buf = []; }
  function getState() { return { bufferSize: _buf.length }; }

  // Load existing signals on init
  init();

  return { emit, drain, init, reset, destroy, getState, peek: () => [..._buf] };
})();

window.GAIA_SIG = GAIA_SIG;

MODULE_CONTRACTS.register('GAIA_SIG', {
  provides: ['init', 'emit', 'drain', 'reset', 'destroy', 'getState', 'peek'],
  requires: ['STORAGE_ADAPTER'],
});
