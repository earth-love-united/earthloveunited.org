/**
 * EventBus — decoupled module communication for Earth Love United.
 *
 * Modules emit events. Other modules listen. Neither side needs to know
 * about the other — the bus mediates.
 *
 * Contract schema extensions:
 *   MODULE_CONTRACTS.register('Name', {
 *     provides: ['init', 'reset', 'destroy', 'getState', 'customMethod'],
 *     requires: ['DepA'],      // hard deps — must load first
 *     emits:   ['eventName'],  // events this module fires
 *     listens: ['eventName'],  // events this module subscribes to
 *   });
 *
 * Runtime:
 *   window.EventBus.emit('eventName', payload)
 *   window.EventBus.on('eventName', callback)    → returns unsubscribe fn
 *   window.EventBus.off('eventName', callback)
 *   window.EventBus.once('eventName', callback)  → auto-unsubscribes after first fire
 */
const EventBus = (() => {
  const _listeners = {};  // eventName → Set of callbacks
  const _wildcards = [];  // callbacks subscribed to '*'

  return {
    /**
     * Emit an event. All listeners for that event name are called synchronously.
     * @param {string} eventName
     * @param {*} payload
     * @returns {number} — how many listeners were notified
     */
    emit(eventName, payload) {
      let count = 0;
      const listeners = _listeners[eventName];
      if (listeners) {
        listeners.forEach(cb => {
          try { cb(payload); } catch (e) { reportError('EventBus', `Listener for "${eventName}" threw: ${e.message}`); }
          count++;
        });
      }
      // Wildcard listeners get everything
      _wildcards.forEach(cb => {
        try { cb(eventName, payload); } catch (e) { reportError('EventBus', `Wildcard listener threw: ${e.message}`); }
        count++;
      });
      return count;
    },

    /**
     * Subscribe to an event. Returns an unsubscribe function.
     * @param {string} eventName — or '*' for all events
     * @param {Function} callback
     * @returns {Function} — call to unsubscribe
     */
    on(eventName, callback) {
      if (eventName === '*') {
        _wildcards.push(callback);
        return () => { const i = _wildcards.indexOf(callback); if (i >= 0) _wildcards.splice(i, 1); };
      }
      if (!_listeners[eventName]) _listeners[eventName] = new Set();
      _listeners[eventName].add(callback);
      return () => { _listeners[eventName]?.delete(callback); };
    },

    /**
     * Subscribe to an event for one emission only.
     * @param {string} eventName
     * @param {Function} callback
     * @returns {Function} — call to unsubscribe (before it fires)
     */
    once(eventName, callback) {
      const unsub = this.on(eventName, (payload) => {
        unsub();
        callback(payload);
      });
      return unsub;
    },

    /**
     * Remove a specific listener. Prefer the unsubscribe function from .on().
     * @param {string} eventName
     * @param {Function} callback
     */
    off(eventName, callback) {
      if (eventName === '*') {
        const i = _wildcards.indexOf(callback);
        if (i >= 0) _wildcards.splice(i, 1);
        return;
      }
      _listeners[eventName]?.delete(callback);
    },

    /**
     * Remove ALL listeners for an event name. Used by destroy() routines.
     * @param {string} eventName — or '*' for wildcards
     */
    clear(eventName) {
      if (eventName === '*') { _wildcards.length = 0; return; }
      delete _listeners[eventName];
    },

    /**
     * Return current state for debugging.
     */
    getState() {
      const events = {};
      for (const [name, cbs] of Object.entries(_listeners)) {
        events[name] = cbs.size;
      }
      return { events, wildcardCount: _wildcards.length };
    },

    /**
     * Remove all listeners. Used on full teardown.
     */
    reset() {
      for (const key of Object.keys(_listeners)) delete _listeners[key];
      _wildcards.length = 0;
    },
  };
})();

// Export: UMD for environments that need it, window for bare-metal
if (typeof module !== 'undefined') module.exports = EventBus;
if (typeof window !== 'undefined') window.EventBus = EventBus;
