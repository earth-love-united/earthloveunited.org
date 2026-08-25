// ═══════════════════════════════════════════════════════════════════════════
// GUIDED FIRST ORBIT — concise, first-visit Climate Intelligence orientation
//
// The tour is deliberately non-modal. Step two releases the globe and ordered
// rail for a real country choice; step three keeps the selected evidence card
// visible, cues one deck move, and completes after that navigation.
// ═══════════════════════════════════════════════════════════════════════════

const GUIDED_ORBIT = (() => {
  const STORAGE_KEY = 'elu-guided-first-orbit-v1';
  const STORAGE_VERSION = 3;
  const COUNTRY_STEP = 2;
  const FINAL_STEP = 2;
  const LENS_LABELS = {
    carbon: 'Territorial fossil CO₂ · 2024',
    power: 'Clean electricity share · 2024',
    physical: 'Projected warming · 2040–2059',
  };

  const STEPS = {
    globe: [
      {
        mode: 'intro',
        title: 'Three lenses. No single score.',
        body: 'Carbon, Power, and Physical answer different questions. They are never combined into a score.',
        hint: 'Three moves · under a minute',
        action: 'Read the atlas',
        lenses: true,
      },
      {
        mode: 'interaction',
        title: 'Change the lens. Choose a country.',
        body: 'Switch Carbon, Power, or Physical, then select a country on the globe or in the sidebar. The sidebar reorders countries for the active lens; only exact metric-and-period matches are numbered.',
        hint: 'Try another lens, then choose from the globe or sidebar',
        waiting: true,
        legend: true,
      },
      {
        mode: 'source',
        title: 'Swipe through the country deck.',
        body: 'Swipe the country card left or right to inspect the next country in this lens order. The previous/next controls, arrow keys, and a horizontal trackpad gesture do the same thing.',
        hint: 'Move once to complete your first orbit',
        waiting: true,
      },
    ],
    fallback: [
      {
        mode: 'intro',
        title: 'Three lenses. No single score.',
        body: 'The searchable evidence view carries Carbon, Power, and Physical without 3D. Each answers a different question; they are never combined into a score.',
        hint: 'Three moves · under a minute',
        action: 'Read the evidence',
        lenses: true,
      },
      {
        mode: 'interaction',
        title: 'Change the lens. Choose a country.',
        body: 'Switch Carbon, Power, or Physical, then search or choose a country. The evidence list reorders for the active lens; only exact metric-and-period matches are numbered.',
        hint: 'Try another lens, then choose from the evidence list',
        waiting: true,
        legend: true,
      },
      {
        mode: 'source',
        title: 'Move through the country records.',
        body: 'Choose another country in the evidence list. This accessible view mirrors the globe card deck without 3D.',
        hint: 'Choose once more to complete your first orbit',
        waiting: true,
      },
    ],
  };

  let initialized = false;
  let active = false;
  let step = 0;
  let route = 'globe';
  let opener = null;
  let fallbackReason = null;
  let startTimer = 0;
  let transitionTimer = 0;
  let focusTimer = 0;
  let announceTimer = 0;
  let subscriptions = [];

  function _emit(name, payload = {}) {
    if (!hasModule('EventBus')) return;
    EventBus.emit(name, {
      ...payload,
      route,
      step: step + 1,
      timestamp: Date.now(),
    });
  }

  function _readStoredStatus() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const value = JSON.parse(stored);
      return value?.version === STORAGE_VERSION ? value.status : null;
    } catch (error) {
      reportWarn('GUIDED_ORBIT', 'Could not read the tutorial preference.');
      return null;
    }
  }

  function _storeStatus(status) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        status,
        updated_at: new Date().toISOString(),
      }));
    } catch (error) {
      reportWarn('GUIDED_ORBIT', 'Could not save the tutorial preference.');
    }
  }

  function _isForced() {
    try {
      return new URLSearchParams(window.location.search).get('guided-orbit') === '1';
    } catch (error) {
      return false;
    }
  }

  function _shouldAutoStart() {
    if (_isForced()) return true;
    // The localhost smoke harness drives the globe directly. Keep its
    // deterministic lifecycle intact; ?guided-orbit=1 remains the QA route.
    if (hasModule('SmokeTest')) return false;
    return _readStoredStatus() === null;
  }

  function _clearStartTimer() {
    if (!startTimer) return;
    window.clearTimeout(startTimer);
    startTimer = 0;
  }

  function _clearTransitionTimer() {
    if (!transitionTimer) return;
    window.clearTimeout(transitionTimer);
    transitionTimer = 0;
  }

  function _clearFocusTimer() {
    if (!focusTimer) return;
    window.clearTimeout(focusTimer);
    focusTimer = 0;
  }

  function _clearAnnounceTimer() {
    if (!announceTimer) return;
    window.clearTimeout(announceTimer);
    announceTimer = 0;
  }

  function _scheduleFocus(callback, delay = 0) {
    _clearFocusTimer();
    const expectedRoute = route;
    const expectedStep = step;
    focusTimer = window.setTimeout(() => {
      focusTimer = 0;
      if (!active || route !== expectedRoute || step !== expectedStep) return;
      callback();
    }, delay);
  }

  function _isVisibleFocusTarget(target) {
    if (!(target instanceof HTMLElement) || !document.contains(target)) return false;
    if (target.hidden || target.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    for (let node = target; node instanceof HTMLElement; node = node.parentElement) {
      const nodeStyle = window.getComputedStyle(node);
      if (nodeStyle.display === 'none' || nodeStyle.visibility === 'hidden' || Number(nodeStyle.opacity) === 0) return false;
    }
    const style = window.getComputedStyle(target);
    return target.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function _suppressUnavailableEvidence(options = {}) {
    _clearStartTimer();
    _clearTransitionTimer();
    active = false;
    step = 0;
    _hide();
    _announce('Climate Intelligence first orbit is unavailable because country evidence could not be loaded.');
    const heading = $('globe-fallback-title');
    if (options.focus !== false && _isVisibleFocusTarget(heading)) heading.focus({ preventScroll: true });
    return false;
  }

  function _clearStepClasses() {
    document.body.classList.remove(
      'guided-orbit-active',
      'guided-orbit-step-1',
      'guided-orbit-step-2',
      'guided-orbit-step-3',
      'guided-orbit-route-fallback'
    );
  }

  function _applyStepClasses() {
    _clearStepClasses();
    if (!active) return;
    document.body.classList.add('guided-orbit-active', `guided-orbit-step-${step + 1}`);
    if (route === 'fallback') document.body.classList.add('guided-orbit-route-fallback');
  }

  function _definition() {
    return STEPS[route]?.[step] || STEPS.globe[step];
  }

  function _stepCount() {
    return STEPS[route]?.length || STEPS.globe.length;
  }

  function _syncLensContext(lensId) {
    const normalized = LENS_LABELS[lensId] ? lensId : safeGet('GlobeModule', 'getLens', 'carbon');
    const selectedLens = LENS_LABELS[normalized] ? normalized : 'carbon';
    const root = $('guided-orbit');
    const guide = $('guided-orbit-lens-guide');
    const legend = $('guided-orbit-legend');
    const model = safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getLegend', selectedLens);
    if (root) root.dataset.lens = selectedLens;
    guide?.querySelectorAll('[data-guided-orbit-lens]').forEach(item => {
      const isActive = item.getAttribute('data-guided-orbit-lens') === selectedLens;
      item.classList.toggle('is-active', isActive);
      if (isActive) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
    if (!legend) return;
    legend.setAttribute('aria-label', `${model?.heading || LENS_LABELS[selectedLens]} tutorial map key`);
    const low = legend.querySelector('[data-guided-orbit-signal="low"]');
    const high = legend.querySelector('[data-guided-orbit-signal="high"]');
    const gap = legend.querySelector('[data-guided-orbit-signal="gap"]');
    if (low && model?.low_label) low.setAttribute('aria-label', model.low_label);
    if (high && model?.high_label) high.setAttribute('aria-label', model.high_label);
    if (gap && model?.gap_label) gap.setAttribute('aria-label', model.gap_label);
    const lowSwatch = low?.querySelector('.guided-orbit-swatch');
    const highSwatch = high?.querySelector('.guided-orbit-swatch');
    if (lowSwatch && model?.low_color) lowSwatch.style.background = model.low_color;
    if (highSwatch && model?.high_color) highSwatch.style.background = model.high_color;
  }

  function _announce(message) {
    const announcer = $('guided-orbit-announcer');
    _clearAnnounceTimer();
    if (announcer) announcer.textContent = '';
    announceTimer = window.setTimeout(() => {
      announceTimer = 0;
      if (announcer) announcer.textContent = message;
    }, 30);
  }

  function _focusInteractionTarget() {
    _scheduleFocus(() => {
      const target = route === 'fallback'
        ? $('globe-fallback-search')
        : document.querySelector('#elu-country-rank-rail .elu-rank-row');
      if (target && typeof target.focus === 'function') {
        if (route === 'fallback' && window.matchMedia('(max-width: 720px)').matches) {
          target.scrollIntoView({ block: 'center' });
        }
        target.focus({ preventScroll: true });
      }
    }, 80);
  }

  function _render(options = {}) {
    if (!active) return false;
    const root = $('guided-orbit');
    const title = $('guided-orbit-title');
    const body = $('guided-orbit-body');
    const hint = $('guided-orbit-hint');
    const kicker = $('guided-orbit-kicker');
    const progress = $('guided-orbit-progress');
    const legend = $('guided-orbit-legend');
    const lensGuide = $('guided-orbit-lens-guide');
    const back = $('guided-orbit-back');
    const primary = $('guided-orbit-primary');
    const definition = _definition();
    const stepCount = _stepCount();
    if (!root || !title || !body || !hint || !kicker || !progress || !legend || !lensGuide || !back || !primary) {
      reportWarn('GUIDED_ORBIT', 'Tutorial markup is incomplete.');
      return false;
    }

    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    root.dataset.mode = definition.mode;
    root.dataset.route = route;
    root.dataset.step = String(step + 1);
    delete root.dataset.actionLocation;
    kicker.textContent = `Climate Intelligence · first orbit · ${step + 1} of ${stepCount}`;
    title.textContent = definition.title;
    body.textContent = definition.body;
    hint.textContent = definition.hint || '';
    hint.hidden = !definition.hint;
    legend.hidden = definition.legend !== true;
    lensGuide.hidden = definition.lenses !== true;
    progress.style.width = `${((step + 1) / stepCount) * 100}%`;
    progress.parentElement?.setAttribute('aria-valuenow', String(step + 1));
    progress.parentElement?.setAttribute('aria-valuemax', String(stepCount));
    back.hidden = step === 0 || (route === 'globe' && step >= COUNTRY_STEP);
    primary.hidden = definition.waiting === true;
    primary.textContent = definition.action || 'Continue';
    _syncLensContext();
    _applyStepClasses();

    _announce(`Step ${step + 1} of ${stepCount}. ${definition.title} ${definition.body} ${definition.hint || ''}`);
    if (definition.mode === 'interaction') {
      _focusInteractionTarget();
    } else if (options.focus !== false) {
      _scheduleFocus(() => title.focus({ preventScroll: true }), 50);
    }
    if (route === 'globe' && step === COUNTRY_STEP) safeCall('GlobeModule', 'cueCountrySwipe');
    _emit('guided-orbit:step');
    return true;
  }

  function _hide() {
    _clearFocusTimer();
    _clearAnnounceTimer();
    const root = $('guided-orbit');
    if (root) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      delete root.dataset.mode;
      delete root.dataset.route;
      delete root.dataset.step;
      delete root.dataset.actionLocation;
      delete root.dataset.lens;
    }
    safeCall('GlobeModule', 'clearCountrySwipeCue');
    _clearStepClasses();
  }

  function _restoreFocus() {
    const selectedHeading = $('country-card-heading');
    const fallbackHeading = $('globe-fallback-detail-title');
    const replay = $('guided-orbit-replay');
    const candidates = [selectedHeading, fallbackHeading, opener, replay];
    for (const candidate of candidates) {
      if (candidate === document.body || !_isVisibleFocusTarget(candidate) || typeof candidate.focus !== 'function') continue;
      candidate.focus({ preventScroll: true });
      if (document.activeElement === candidate) return;
    }
    // The tutorial itself hides the toolbar action group. Its removal and the
    // toolbar's next style calculation can fall on separate paints, so retry
    // the stable replay target once without stealing focus from a restarted
    // tour or a route that has already hidden the toolbar.
    window.requestAnimationFrame(() => {
      if (active) return;
      const visibleReplay = $('guided-orbit-replay');
      if (_isVisibleFocusTarget(visibleReplay)) visibleReplay.focus({ preventScroll: true });
    });
  }

  function start(options = {}) {
    if (!initialized || !document.body.classList.contains('globe-mode')) return false;
    _clearStartTimer();
    _clearTransitionTimer();
    route = options.route || (document.body.classList.contains('globe-fallback-active') ? 'fallback' : 'globe');
    fallbackReason = route === 'fallback'
      ? (options.reason || fallbackReason || window.GlobeModule?._fallbackReasonCode || null)
      : null;
    if (route === 'fallback' && fallbackReason === 'candidate_data_unavailable') {
      return _suppressUnavailableEvidence(options);
    }
    opener = options.opener || document.activeElement;
    step = 0;
    active = true;
    if (route === 'globe') safeCall('GlobeModule', 'clearCountrySelection');
    const rendered = _render({ focus: options.focus !== false });
    if (rendered) _emit('guided-orbit:started', { forced: options.force === true });
    return rendered;
  }

  function goToStep(nextStep, options = {}) {
    if (!active) return false;
    step = Math.max(0, Math.min(_stepCount() - 1, nextStep));
    if (step < COUNTRY_STEP && route === 'globe') safeCall('GlobeModule', 'clearCountrySelection');
    return _render(options);
  }

  function complete(options = {}) {
    if (!active) return false;
    active = false;
    _storeStatus('completed');
    _hide();
    _restoreFocus();
    _announce('Climate Intelligence first orbit complete. Explore freely.');
    _emit('guided-orbit:completed', { source: options.source || 'tutorial' });
    return true;
  }

  function skip() {
    if (!active) return false;
    active = false;
    _storeStatus('dismissed');
    _hide();
    _restoreFocus();
    _announce('Climate Intelligence first orbit skipped. Replay it from the orbit button in the globe toolbar.');
    _emit('guided-orbit:dismissed');
    return true;
  }

  function _onCountrySelected() {
    if (!active || route !== 'globe' || step !== 1) return;
    _clearTransitionTimer();
    transitionTimer = window.setTimeout(() => {
      transitionTimer = 0;
      if (!active || route !== 'globe' || step !== 1) return;
      goToStep(COUNTRY_STEP, { focus: false });
    }, 120);
  }

  function _onCountryNavigated(payload) {
    if (!active || route !== 'globe' || step !== COUNTRY_STEP) return;
    complete({ source: payload?.source || 'deck' });
  }

  function _onCountryClosed() {
    if (!active || route !== 'globe' || step < 1) return;
    _clearTransitionTimer();
    if (step >= COUNTRY_STEP) goToStep(1, { focus: false });
    _announce('Country card closed. Choose another country to continue the tutorial.');
  }

  function _onLensChanged(payload) {
    _syncLensContext(payload?.id);
  }

  function _onFallbackShown(payload) {
    route = 'fallback';
    fallbackReason = payload?.reason || window.GlobeModule?._fallbackReasonCode || null;
    if (fallbackReason === 'candidate_data_unavailable') {
      _suppressUnavailableEvidence({ focus: false });
      return;
    }
    if (active) _render({ focus: false });
  }

  function _onFallbackHidden() {
    if (!active || route !== 'fallback' || !document.body.classList.contains('globe-mode')) return;
    route = 'globe';
    fallbackReason = null;
    if (step >= COUNTRY_STEP) step = 1;
    _render({ focus: true });
  }

  function _onGlobeEntered(payload) {
    route = payload?.fallback === true ? 'fallback' : 'globe';
    fallbackReason = route === 'fallback'
      ? (payload?.reason || window.GlobeModule?._fallbackReasonCode || null)
      : null;
    if (route === 'fallback' && fallbackReason === 'candidate_data_unavailable') {
      _suppressUnavailableEvidence({ focus: false });
      return;
    }
    if (!_shouldAutoStart()) return;
    _clearStartTimer();
    startTimer = window.setTimeout(() => {
      startTimer = 0;
      start({ route, reason: fallbackReason, focus: true });
    }, 320);
  }

  function _onGlobeExited() {
    _clearStartTimer();
    _clearTransitionTimer();
    _clearAnnounceTimer();
    active = false;
    fallbackReason = null;
    _hide();
  }

  function _onPrimaryClick() {
    if (step === FINAL_STEP) complete();
    else goToStep(step + 1);
  }

  function _onBackClick() {
    goToStep(step - 1);
  }

  function _onCloseClick() {
    skip();
  }

  function _onDocumentClick(event) {
    if (!(event.target instanceof Element)) return;
    const replay = event.target.closest('#guided-orbit-replay');
    if (replay) {
      event.preventDefault();
      start({ force: true, opener: replay });
      return;
    }

    if (!active || route !== 'fallback' || (step !== 1 && step !== COUNTRY_STEP)) return;
    const fallbackCountry = event.target.closest('[data-fallback-country-iso]');
    if (!fallbackCountry) return;
    const expectedStep = step;
    _clearTransitionTimer();
    transitionTimer = window.setTimeout(() => {
      transitionTimer = 0;
      if (!active || step !== expectedStep || route !== 'fallback') return;
      const detail = $('globe-fallback-country-detail');
      if (detail && window.matchMedia('(max-width: 720px)').matches) {
        detail.scrollIntoView({ block: 'start' });
      }
      if (expectedStep === 1) goToStep(COUNTRY_STEP, { focus: false });
      else complete({ source: 'fallback-list' });
    }, 120);
  }

  function _onKeyDown(event) {
    if (!active || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    skip();
  }

  function init() {
    if (initialized) return true;
    if (!$('guided-orbit') || !$('guided-orbit-replay')) {
      reportWarn('GUIDED_ORBIT', 'Tutorial controls are unavailable.');
      return false;
    }
    initialized = true;

    $('guided-orbit-primary')?.addEventListener('click', _onPrimaryClick);
    $('guided-orbit-back')?.addEventListener('click', _onBackClick);
    $('guided-orbit-close')?.addEventListener('click', _onCloseClick);
    document.addEventListener('click', _onDocumentClick);
    document.addEventListener('keydown', _onKeyDown, true);

    if (hasModule('EventBus')) {
      subscriptions = [
        EventBus.on('app:globe-entered', _onGlobeEntered),
        EventBus.on('app:globe-exited', _onGlobeExited),
        EventBus.on('globe:country-selected', _onCountrySelected),
        EventBus.on('globe:country-navigated', _onCountryNavigated),
        EventBus.on('globe:country-closed', _onCountryClosed),
        EventBus.on('globe:fallback-shown', _onFallbackShown),
        EventBus.on('globe:fallback-hidden', _onFallbackHidden),
        EventBus.on('globe:lens-changed', _onLensChanged),
      ];
    } else {
      reportWarn('GUIDED_ORBIT', 'EventBus is unavailable.');
    }
    return true;
  }

  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      reportWarn('GUIDED_ORBIT', 'Could not reset the tutorial preference.');
    }
    active = false;
    step = 0;
    route = 'globe';
    fallbackReason = null;
    _clearStartTimer();
    _clearTransitionTimer();
    _clearFocusTimer();
    _clearAnnounceTimer();
    _hide();
    return true;
  }

  function destroy() {
    _clearStartTimer();
    _clearTransitionTimer();
    _clearFocusTimer();
    _clearAnnounceTimer();
    subscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    subscriptions = [];
    document.removeEventListener('click', _onDocumentClick);
    document.removeEventListener('keydown', _onKeyDown, true);
    $('guided-orbit-primary')?.removeEventListener('click', _onPrimaryClick);
    $('guided-orbit-back')?.removeEventListener('click', _onBackClick);
    $('guided-orbit-close')?.removeEventListener('click', _onCloseClick);
    initialized = false;
    active = false;
    step = 0;
    route = 'globe';
    fallbackReason = null;
    opener = null;
    _hide();
    return true;
  }

  function getState() {
    return {
      initialized,
      active,
      route,
      step: step + 1,
      fallbackReason,
      stepCount: _stepCount(),
      awaitingDeckMove: active && step === COUNTRY_STEP,
      storedStatus: _readStoredStatus(),
    };
  }

  return { init, start, goToStep, complete, skip, reset, destroy, getState };
})();

window.GUIDED_ORBIT = GUIDED_ORBIT;

MODULE_CONTRACTS.register('GUIDED_ORBIT', {
  provides: ['init', 'start', 'goToStep', 'complete', 'skip', 'reset', 'destroy', 'getState'],
  requires: ['EventBus', 'GlobeModule', 'COUNTRY_CLIMATE_INTELLIGENCE'],
  emits: ['guided-orbit:started', 'guided-orbit:step', 'guided-orbit:completed', 'guided-orbit:dismissed'],
  listens: ['app:globe-entered', 'app:globe-exited', 'globe:country-selected', 'globe:country-navigated', 'globe:country-closed', 'globe:fallback-shown', 'globe:fallback-hidden', 'globe:lens-changed'],
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GUIDED_ORBIT.init());
} else {
  GUIDED_ORBIT.init();
}
