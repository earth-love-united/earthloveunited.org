/**
 * GAIA SIGNALS v1.0
 * Dumb pipe. Stores raw events in localStorage.
 * Both pages write. gaia.html drains on init.
 *
 * index.html modules → GAIA_SIG.emit('site_tap', {siteId}) → localStorage
 * gaia-integration.js → GAIA_SIG.drain() → GaiaMind.updateParticipantModel()
 */
const GAIA_SIG = (() => {
  const KEY = 'gaia_signals';
  let _buf = [];

  function emit(e, p) {
    _buf.push({ e, p: p || {}, t: Date.now() });
    if (_buf.length > 200) _buf = _buf.slice(-200);
    try { localStorage.setItem(KEY, JSON.stringify(_buf)); } catch {}
  }

  function drain() {
    const out = _buf.splice(0);
    try { localStorage.removeItem(KEY); } catch {}
    return out;
  }

  // Load existing signals on init
  try { const r = localStorage.getItem(KEY); if (r) _buf = JSON.parse(r); } catch {}

  return { emit, drain, peek: () => [..._buf] };
})();
