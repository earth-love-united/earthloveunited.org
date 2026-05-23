/**
 * EVENT FLOW TRACER
 * Wraps safeCall/safeGet/hasModule to log all cross-module communication.
 * Shows the full call graph in real-time.
 *
 * Run in browser console:
 *   Tracer.start()          — start tracing
 *   Tracer.stop()           — stop tracing
 *   Tracer.report()         — show call statistics
 *   Tracer.graph()          — show dependency graph
 *   Tracer.failed()         — show only failed calls
 *   Tracer.clear()          — clear history
 */

const Tracer = (() => {
  let _active = false;
  let _log = [];
  let _origSafeCall = null;
  let _origSafeGet = null;
  let _origHasModule = null;

  function start() {
    if (_active) {
      console.log('[Tracer] Already active');
      return;
    }

    // Save originals
    _origSafeCall = window.safeCall;
    _origSafeGet = window.safeGet;
    _origHasModule = window.hasModule;

    // Wrap safeCall
    window.safeCall = function(globalName, methodName, ...args) {
      const available = typeof window[globalName] !== 'undefined' && window[globalName] !== null;
      const hasMethod = available && typeof window[globalName][methodName] === 'function';
      
      const entry = {
        type: 'safeCall',
        target: globalName,
        method: methodName,
        args: args.map(_summarizeArg),
        available,
        hasMethod,
        time: Date.now(),
        stack: _getCallerInfo(),
      };

      let result;
      if (hasMethod) {
        try {
          result = _origSafeCall(globalName, methodName, ...args);
          entry.success = true;
          entry.returned = _summarizeArg(result);
        } catch (err) {
          entry.success = false;
          entry.error = err.message;
          result = undefined;
        }
      } else {
        entry.success = false;
        entry.error = !available ? 'MODULE_NOT_ON_WINDOW' : 'METHOD_NOT_FOUND';
        result = undefined;
      }

      _log.push(entry);

      // Live log
      if (entry.success) {
        console.log(`%c→ ${globalName}.${methodName}(${entry.args.join(', ')})`,
          'color: #4ecdc4; font-size: 10px',
          entry.returned !== undefined ? `⇐ ${entry.returned}` : '');
      } else {
        console.warn(`%c✗ ${globalName}.${methodName}() — ${entry.error}`,
          'color: #ff6b6b; font-size: 10px',
          `[from: ${entry.stack}]`);
      }

      return result;
    };

    // Wrap safeGet
    window.safeGet = function(globalName, methodName, defaultVal) {
      const entry = {
        type: 'safeGet',
        target: globalName,
        method: methodName,
        time: Date.now(),
        stack: _getCallerInfo(),
      };

      const result = _origSafeGet(globalName, methodName, defaultVal);
      entry.success = result !== defaultVal;
      entry.returned = _summarizeArg(result);
      _log.push(entry);
      return result;
    };

    // Wrap hasModule
    window.hasModule = function(name) {
      const result = _origHasModule(name);
      _log.push({
        type: 'hasModule',
        target: name,
        available: result,
        time: Date.now(),
      });
      return result;
    };

    _active = true;
    console.log('%c🔍 [Tracer] ACTIVE — all safeCall/safeGet/hasModule calls are being traced',
      'color: #ffd700; font-weight: bold');
    console.log('   Tracer.stop() to stop, Tracer.report() for stats, Tracer.graph() for dependency graph');
  }

  function stop() {
    if (!_active) return;
    window.safeCall = _origSafeCall;
    window.safeGet = _origSafeGet;
    window.hasModule = _origHasModule;
    _active = false;
    console.log(`%c🔍 [Tracer] STOPPED — ${_log.length} events captured`, 'color: #ffd700');
  }

  function report() {
    if (_log.length === 0) {
      console.log('[Tracer] No events captured. Run Tracer.start() first.');
      return;
    }

    console.group('%c📊 TRACER REPORT', 'color: #4ecdc4; font-weight: bold; font-size: 14px');

    // Call frequency by target module
    const byTarget = {};
    _log.filter(e => e.type === 'safeCall').forEach(e => {
      const key = `${e.target}.${e.method}`;
      if (!byTarget[key]) byTarget[key] = { calls: 0, success: 0, fail: 0 };
      byTarget[key].calls++;
      if (e.success) byTarget[key].success++;
      else byTarget[key].fail++;
    });

    console.group('📞 Call Frequency');
    console.table(Object.entries(byTarget)
      .sort((a, b) => b[1].calls - a[1].calls)
      .map(([key, v]) => ({
        Method: key,
        Calls: v.calls,
        '✅': v.success,
        '❌': v.fail,
        'Fail%': v.fail > 0 ? Math.round(v.fail / v.calls * 100) + '%' : '0%',
      })));
    console.groupEnd();

    // hasModule checks
    const moduleChecks = {};
    _log.filter(e => e.type === 'hasModule').forEach(e => {
      if (!moduleChecks[e.target]) moduleChecks[e.target] = { checks: 0, found: 0 };
      moduleChecks[e.target].checks++;
      if (e.available) moduleChecks[e.target].found++;
    });

    console.group('🔍 Module Availability Checks');
    console.table(Object.entries(moduleChecks)
      .sort((a, b) => b[1].checks - a[1].checks)
      .map(([name, v]) => ({
        Module: name,
        Checks: v.checks,
        Found: v.found,
        Available: v.found === v.checks ? '✅' : `⚠️ ${v.checks - v.found} misses`,
      })));
    console.groupEnd();

    // Failed calls
    const failures = _log.filter(e => e.type === 'safeCall' && !e.success);
    if (failures.length > 0) {
      console.group(`🔴 Failed Calls (${failures.length})`);
      failures.forEach(f => {
        console.warn(`${f.target}.${f.method}() — ${f.error} [from: ${f.stack}]`);
      });
      console.groupEnd();
    }

    console.log(`\nTotal events: ${_log.length} | safeCall: ${_log.filter(e => e.type === 'safeCall').length} | hasModule: ${_log.filter(e => e.type === 'hasModule').length} | safeGet: ${_log.filter(e => e.type === 'safeGet').length}`);
    console.groupEnd();
  }

  function graph() {
    if (_log.length === 0) {
      console.log('[Tracer] No events. Run Tracer.start() and interact with the page first.');
      return;
    }

    // Build a caller → callee dependency map
    const edges = {};
    _log.filter(e => e.type === 'safeCall').forEach(e => {
      const caller = e.stack.split('/').pop().split(':')[0] || 'unknown';
      const callee = e.target;
      const key = `${caller} → ${callee}`;
      if (!edges[key]) edges[key] = { calls: 0, methods: new Set() };
      edges[key].calls++;
      edges[key].methods.add(e.method);
    });

    console.group('%c🗺️ DEPENDENCY GRAPH', 'color: #4ecdc4; font-weight: bold; font-size: 14px');
    console.table(Object.entries(edges)
      .sort((a, b) => b[1].calls - a[1].calls)
      .map(([edge, v]) => ({
        Edge: edge,
        Calls: v.calls,
        Methods: [...v.methods].join(', '),
      })));
    console.groupEnd();
  }

  function failed() {
    const failures = _log.filter(e => !e.success && e.type === 'safeCall');
    if (failures.length === 0) {
      console.log('%c✅ No failed calls', 'color: #4ecdc4');
      return;
    }
    console.group(`🔴 ${failures.length} Failed Calls`);
    failures.forEach(f => {
      console.warn(`${f.target}.${f.method}(${f.args.join(', ')}) — ${f.error}`, `\n  from: ${f.stack}`);
    });
    console.groupEnd();
  }

  function clear() {
    _log = [];
    console.log('[Tracer] History cleared');
  }

  // ── Helpers ──
  function _summarizeArg(val) {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'string') return val.length > 30 ? `"${val.substring(0, 30)}..."` : `"${val}"`;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return `Array(${val.length})`;
    if (typeof val === 'object') return `{${Object.keys(val).slice(0, 3).join(', ')}${Object.keys(val).length > 3 ? '...' : ''}}`;
    if (typeof val === 'function') return 'fn()';
    return String(val);
  }

  function _getCallerInfo() {
    try {
      const stack = new Error().stack.split('\n');
      // Skip Error, _getCallerInfo, safeCall wrapper — get the actual caller
      const callerLine = stack[4] || stack[3] || stack[2] || '';
      const match = callerLine.match(/at\s+.*?(\S+\.js:\d+)/);
      return match ? match[1] : callerLine.trim().substring(0, 60);
    } catch {
      return 'unknown';
    }
  }

  return { start, stop, report, graph, failed, clear, get log() { return [..._log]; } };
})();
window.Tracer = Tracer;
