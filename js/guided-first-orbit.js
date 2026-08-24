// ═══════════════════════════════════════════════════════════════════════════
// GUIDED FIRST ORBIT — concise, first-visit globe orientation
//
// The tour is deliberately non-modal. Step two releases the globe and rank
// rail for a real country choice; step three keeps the selected evidence card
// visible while the tutorial collapses into a compact shelf.
// ═══════════════════════════════════════════════════════════════════════════

const GUIDED_ORBIT = (() => {
  const STORAGE_KEY = 'elu-guided-first-orbit-v1';
  const STORAGE_VERSION = 1;

  const STEPS = {
    globe: [
      {
        mode: 'intro',
        title: 'A climate evidence atlas.',
        body: 'Compare 2023 country emissions estimates. This is evidence—not a performance score.',
        hint: 'Three ideas · about twenty seconds',
        action: 'Read the map',
      },
      {
        mode: 'interaction',
        title: 'Read the map',
        body: 'Color shows emissions magnitude. Pattern marks a missing source—not zero emissions.',
        hint: 'Tap the globe or choose a country code',
        waiting: true,
        legend: true,
      },
      {
        mode: 'source',
        title: 'Follow the evidence.',
        body: 'The country card keeps the annual series, source, methodology and limits with the number.',
        action: 'Explore freely',
      },
    ],
    fallback: [
      {
        mode: 'intro',
        title: 'The evidence works without 3D.',
        body: 'The globe is a country evidence atlas. The searchable records remain usable when the 3D view is unavailable.',
        hint: 'Three ideas · about twenty seconds',
        action: 'Read the evidence',
      },
      {
        mode: 'interaction',
        title: 'Read the evidence',
        body: 'Reviewed estimates share one metric. Missing sources stay visible and unranked.',
        hint: 'Search or choose any country record',
        waiting: true,
        legend: true,
      },
      {
        mode: 'source',
        title: 'Follow the evidence.',
        body: 'Each record keeps its annual series, source, methodology and known limits close.',
        action: 'Explore freely',
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

  function _isVisibleFocusTarget(target) {
    if (!(target instanceof HTMLElement) || !document.contains(target)) return false;
    if (target.hidden || target.closest('[hidden],[aria-hidden="true"]')) return false;
    const style = window.getComputedStyle(target);
    return target.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function _removeDialogCompletion() {
    const button = $('guided-orbit-dialog-complete');
    if (!button) return;
    button.removeEventListener('click', _onDialogCompleteClick);
    button.remove();
  }

  function _mountDialogCompletion() {
    _removeDialogCompletion();
    if (!active || route !== 'globe' || step !== 2) return false;
    const card = $('hex-country-tooltip');
    const wrap = $('elu-country-card-wrap');
    if (!card || !wrap || !wrap.contains(card) || card.getAttribute('aria-hidden') === 'true') return false;
    const button = document.createElement('button');
    button.id = 'guided-orbit-dialog-complete';
    button.className = 'guided-orbit-button guided-orbit-dialog-complete';
    button.type = 'button';
    button.textContent = 'Explore freely';
    button.setAttribute('aria-label', 'Finish tutorial and explore freely');
    button.addEventListener('click', _onDialogCompleteClick);
    const anchor = card.querySelector('.tt-detail');
    if (anchor) anchor.after(button);
    else card.prepend(button);
    return true;
  }

  function _suppressUnavailableEvidence(options = {}) {
    _clearStartTimer();
    _clearTransitionTimer();
    active = false;
    step = 0;
    _hide();
    _announce('Guided First Orbit is unavailable because country evidence could not be loaded.');
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

  function _announce(message) {
    const announcer = $('guided-orbit-announcer');
    if (announcer) announcer.textContent = '';
    window.setTimeout(() => {
      if (announcer) announcer.textContent = message;
    }, 30);
  }

  function _focusInteractionTarget() {
    const target = route === 'fallback'
      ? $('globe-fallback-search')
      : document.querySelector('#elu-country-rank-rail .elu-rank-row');
    if (target && typeof target.focus === 'function') {
      window.setTimeout(() => {
        if (route === 'fallback' && window.matchMedia('(max-width: 720px)').matches) {
          target.scrollIntoView({ block: 'center' });
        }
        target.focus({ preventScroll: true });
      }, 80);
    }
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
    const back = $('guided-orbit-back');
    const primary = $('guided-orbit-primary');
    const definition = _definition();
    if (!root || !title || !body || !hint || !kicker || !progress || !legend || !back || !primary) {
      reportWarn('GUIDED_ORBIT', 'Tutorial markup is incomplete.');
      return false;
    }

    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    root.dataset.mode = definition.mode;
    root.dataset.route = route;
    root.dataset.step = String(step + 1);
    const completesInsideCountryDialog = route === 'globe' && step === 2;
    if (completesInsideCountryDialog) root.dataset.completion = 'country-dialog';
    else delete root.dataset.completion;
    kicker.textContent = `Guided first orbit · ${step + 1} of 3`;
    title.textContent = definition.title;
    body.textContent = definition.body;
    hint.textContent = definition.hint || '';
    hint.hidden = !definition.hint;
    legend.hidden = definition.legend !== true;
    progress.style.width = `${((step + 1) / 3) * 100}%`;
    progress.parentElement?.setAttribute('aria-valuenow', String(step + 1));
    back.hidden = step === 0 || step === 2;
    primary.hidden = definition.waiting === true || completesInsideCountryDialog;
    primary.textContent = definition.action || 'Continue';
    _applyStepClasses();

    _announce(`Step ${step + 1} of 3. ${definition.title} ${definition.body} ${definition.hint || ''}`);
    if (definition.mode === 'interaction') {
      _focusInteractionTarget();
    } else if (options.focus !== false) {
      window.setTimeout(() => title.focus({ preventScroll: true }), 50);
    }
    if (completesInsideCountryDialog) {
      _mountDialogCompletion();
    } else {
      _removeDialogCompletion();
    }
    _emit('guided-orbit:step');
    return true;
  }

  function _hide() {
    const root = $('guided-orbit');
    if (root) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      delete root.dataset.mode;
      delete root.dataset.route;
      delete root.dataset.step;
      delete root.dataset.completion;
    }
    _removeDialogCompletion();
    _clearStepClasses();
  }

  function _restoreFocus() {
    const selectedHeading = $('country-card-heading');
    const fallbackHeading = $('globe-fallback-detail-title');
    const replay = $('guided-orbit-replay');
    const target = [selectedHeading, fallbackHeading, opener, replay].find(_isVisibleFocusTarget);
    if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
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
    step = Math.max(0, Math.min(2, nextStep));
    if (step < 2 && route === 'globe') safeCall('GlobeModule', 'clearCountrySelection');
    return _render(options);
  }

  function complete() {
    if (!active) return false;
    active = false;
    _storeStatus('completed');
    _hide();
    _restoreFocus();
    _announce('Guided First Orbit complete. Explore freely.');
    _emit('guided-orbit:completed');
    return true;
  }

  function skip() {
    if (!active) return false;
    active = false;
    _storeStatus('dismissed');
    _hide();
    _restoreFocus();
    _announce('Guided First Orbit skipped. Replay it from the orbit button in the globe toolbar.');
    _emit('guided-orbit:dismissed');
    return true;
  }

  function _onCountrySelected() {
    if (!active || route !== 'globe') return;
    _clearTransitionTimer();
    transitionTimer = window.setTimeout(() => {
      transitionTimer = 0;
      if (!active || route !== 'globe') return;
      if (step === 1) goToStep(2, { focus: false });
      else if (step === 2) _mountDialogCompletion();
    }, 120);
  }

  function _onCountryClosed() {
    if (!active || route !== 'globe' || (step !== 1 && step !== 2)) return;
    _clearTransitionTimer();
    if (step === 2) goToStep(1, { focus: false });
    _announce('Country card closed. Choose another country to finish the tutorial.');
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
      start({ route, reason: fallbackReason, focus: false });
    }, 320);
  }

  function _onGlobeExited() {
    _clearStartTimer();
    _clearTransitionTimer();
    active = false;
    fallbackReason = null;
    _hide();
  }

  function _onPrimaryClick() {
    if (step === 2) complete();
    else goToStep(step + 1);
  }

  function _onBackClick() {
    goToStep(step - 1);
  }

  function _onCloseClick() {
    skip();
  }

  function _onDialogCompleteClick() {
    complete();
  }

  function _onDocumentClick(event) {
    if (!(event.target instanceof Element)) return;
    const replay = event.target.closest('#guided-orbit-replay');
    if (replay) {
      event.preventDefault();
      start({ force: true, opener: replay });
      return;
    }

    if (!active || step !== 1 || route !== 'fallback') return;
    const fallbackCountry = event.target.closest('[data-fallback-country-iso]');
    if (!fallbackCountry) return;
    window.setTimeout(() => {
      const detail = $('globe-fallback-country-detail');
      if (detail && window.matchMedia('(max-width: 720px)').matches) {
        detail.scrollIntoView({ block: 'start' });
      }
      goToStep(2, { focus: false });
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
        EventBus.on('globe:country-closed', _onCountryClosed),
        EventBus.on('globe:fallback-shown', _onFallbackShown),
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
    _hide();
    return true;
  }

  function destroy() {
    _clearStartTimer();
    _clearTransitionTimer();
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
      dialogCompletionMounted: !!$('guided-orbit-dialog-complete'),
      storedStatus: _readStoredStatus(),
    };
  }

  return { init, start, goToStep, complete, skip, reset, destroy, getState };
})();

window.GUIDED_ORBIT = GUIDED_ORBIT;

MODULE_CONTRACTS.register('GUIDED_ORBIT', {
  provides: ['init', 'start', 'goToStep', 'complete', 'skip', 'reset', 'destroy', 'getState'],
  requires: ['EventBus', 'GlobeModule'],
  emits: ['guided-orbit:started', 'guided-orbit:step', 'guided-orbit:completed', 'guided-orbit:dismissed'],
  listens: ['app:globe-entered', 'app:globe-exited', 'globe:country-selected', 'globe:country-closed', 'globe:fallback-shown'],
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GUIDED_ORBIT.init());
} else {
  GUIDED_ORBIT.init();
}
