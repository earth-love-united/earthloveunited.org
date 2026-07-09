/**
 * BRIDGE CLIENT — WebSocket bridge to infra/bridge.py
 *
 * Connects the frontend EventBus to the backend WebSocket bridge.
 * Subscribes to ALL internal events (wildcard *) and forwards them
 * to the backend as structured publish messages.
 *
 * Protocol:
 *   On connect → send {"type": "subscribe", "channel": "all"}
 *   On any EventBus event → send {"type": "publish", "channel": "events", "payload": {"event": name, "data": payload}}
 */

const BRIDGE_CLIENT = (() => {
  let _ws = null;
  let _unsubWildcard = null;
  let _reconnectTimer = null;
  let _connected = false;
  // Set of event names that originated from the bridge — skip re-forwarding
  let _bridgeEvents = null;

  const WS_URL = 'ws://127.0.0.1:8765';
  const RECONNECT_DELAY = 3000;

  // Only attempt to connect on localhost — the bridge is a local dev service.
  // On production deploys (Cloudflare Pages, Hostinger, etc.) there is no
  // bridge to connect to, so we no-op silently instead of spamming reconnect
  // errors in the console.
  const _IS_LOCAL = typeof location !== 'undefined' && (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '::1' ||
    location.protocol === 'file:'
  );

  function connect() {
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      _ws = new WebSocket(WS_URL);

      _ws.onopen = () => {
        _connected = true;
        console.debug('[Bridge] Connected to', WS_URL);
        // Subscribe to all channels on the backend
        _ws.send(JSON.stringify({ type: 'subscribe', channel: 'all' }));
      };

      _ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'event' && msg.channel === 'events') {
            // Mark as bridge-originated to prevent echo loop
            if (_bridgeEvents) _bridgeEvents.add(msg.event);
            // Forward backend events into the internal EventBus
            if (window.EventBus) {
              window.EventBus.emit(msg.event, msg.data);
            }
            // Clean up after a tick so the wildcard sub has time to fire
            if (_bridgeEvents) {
              setTimeout(() => { if (_bridgeEvents) _bridgeEvents.delete(msg.event); }, 0);
            }
          }
        } catch (err) {
          console.warn('[Bridge] Failed to parse message:', err.message);
        }
      };

      _ws.onclose = () => {
        _connected = false;
        console.debug('[Bridge] Disconnected — reconnecting in', RECONNECT_DELAY, 'ms');
        _scheduleReconnect();
      };

      _ws.onerror = (err) => {
        console.warn('[Bridge] WebSocket error — will reconnect');
        // onclose will fire after this, triggering reconnect
      };
    } catch (err) {
      console.warn('[Bridge] Failed to create WebSocket:', err.message);
      _scheduleReconnect();
    }
  }

  function _scheduleReconnect() {
    if (_reconnectTimer) clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY);
  }

  /**
   * Forward an internal EventBus event to the WebSocket bridge.
   * Called for every event via the wildcard subscription.
   */
  function forwardEvent(eventName, payload) {
    // Skip events that originated from the bridge (prevents echo loop)
    if (_bridgeEvents && _bridgeEvents.has(eventName)) return;
    if (!_connected || !_ws || _ws.readyState !== WebSocket.OPEN) return;
    try {
      _ws.send(JSON.stringify({
        type: 'publish',
        channel: 'events',
        payload: { event: eventName, data: payload, timestamp: Date.now() },
      }));
    } catch (err) {
      console.warn('[Bridge] Failed to send:', err.message);
    }
  }

  return {
    init() {
      // No-op on production — the bridge is a local dev service only.
      if (!_IS_LOCAL) {
        return false;
      }

      console.debug('[Bridge] init');

      // Connect to the WebSocket bridge
      connect();

      // Initialize echo-guard set
      _bridgeEvents = new Set();

      // Subscribe to ALL EventBus events (wildcard) and forward them
      if (window.EventBus) {
        _unsubWildcard = window.EventBus.on('*', (eventName, payload) => {
          forwardEvent(eventName, payload);
        });
      }

      return true;
    },

    reset() {
      console.debug('[Bridge] reset');
      // Reconnect cleanly
      if (_ws) {
        _ws.onclose = null; // prevent reconnect scheduling
        _ws.close();
        _ws = null;
      }
      _connected = false;
      connect();
      return true;
    },

    destroy() {
      console.debug('[Bridge] destroy');

      // Unsubscribe from EventBus wildcard
      if (_unsubWildcard) {
        _unsubWildcard();
        _unsubWildcard = null;
      }

      // Clear echo-guard set
      if (_bridgeEvents) {
        _bridgeEvents.clear();
        _bridgeEvents = null;
      }

      // Clear reconnect timer
      if (_reconnectTimer) {
        clearTimeout(_reconnectTimer);
        _reconnectTimer = null;
      }

      // Close WebSocket
      if (_ws) {
        _ws.onclose = null; // prevent reconnect scheduling
        _ws.close();
        _ws = null;
      }
      _connected = false;

      return true;
    },

    getState() {
      return {
        connected: _connected,
        url: WS_URL,
        hasWildcardSub: !!_unsubWildcard,
      };
    },
  };
})();
window.BRIDGE_CLIENT = BRIDGE_CLIENT;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('BRIDGE_CLIENT', {
    provides: ['init', 'destroy', 'getState'],
    requires: ['EventBus'],
    emits: [],
    listens: ['*'],
  });
}
