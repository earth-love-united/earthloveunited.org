/**
 * DIFF GUARD
 * Run tests before and after a change, show what broke.
 *
 * Console commands:
 *   DiffGuard.before()    — snapshot test results BEFORE your change
 *   DiffGuard.after()     — snapshot test results AFTER your change, show diff
 *   DiffGuard.status()    — show current guard status
 */

const DiffGuard = (() => {
  let _beforeResults = null;
  let _afterResults = null;

  async function before() {
    if (typeof SmokeTest === 'undefined') {
      console.error('[DiffGuard] SmokeTest not loaded. Include tools/smoke-test.js first.');
      return;
    }
    console.log('%c🛡️ [DiffGuard] Running BEFORE snapshot...', 'color: #ffd700; font-weight: bold;');
    _beforeResults = await SmokeTest.run();
    const pass = _beforeResults.filter(r => r.pass).length;
    const total = _beforeResults.length;
    console.log(`%c🛡️ [DiffGuard] BEFORE captured: ${pass}/${total} passing`, 'color: #4ecdc4; font-weight: bold;');
    console.log('   Now make your changes, then run DiffGuard.after()');
  }

  async function after() {
    if (!_beforeResults) {
      console.error('[DiffGuard] No BEFORE snapshot. Run DiffGuard.before() first.');
      return;
    }

    console.log('%c🛡️ [DiffGuard] Running AFTER snapshot...', 'color: #ffd700; font-weight: bold;');
    _afterResults = await SmokeTest.run();

    // Compare
    console.group('%c🛡️ DIFF GUARD RESULTS', 'color: #ff6b6b; font-weight: bold; font-size: 14px;');
    
    let regressions = 0;
    let improvements = 0;
    let unchanged = 0;

    for (let i = 0; i < _afterResults.length; i++) {
      const before = _beforeResults[i];
      const after = _afterResults[i];
      
      if (!before || !after) continue;

      if (before.pass && !after.pass) {
        regressions++;
        console.error(`  🔴 REGRESSION: ${after.name}\n     Before: ✅ ${before.detail}\n     After:  ❌ ${after.detail}`);
      } else if (!before.pass && after.pass) {
        improvements++;
        console.log(`  🟢 FIXED: ${after.name}\n     Before: ❌ ${before.detail}\n     After:  ✅ ${after.detail}`);
      } else {
        unchanged++;
      }
    }

    if (regressions > 0) {
      console.error(`\n🔴 ${regressions} REGRESSIONS! ${improvements} fixed, ${unchanged} unchanged.`);
    } else if (improvements > 0) {
      console.log(`\n%c✅ No regressions! ${improvements} improved, ${unchanged} unchanged.`, 'color: #4ecdc4; font-weight: bold;');
    } else {
      console.log(`\n%c✅ All ${unchanged} tests unchanged.`, 'color: #4ecdc4;');
    }

    console.groupEnd();
    return { regressions, improvements, unchanged };
  }

  function status() {
    console.group('%c🛡️ DIFF GUARD STATUS', 'color: #4ecdc4; font-weight: bold;');
    if (_beforeResults) {
      const pass = _beforeResults.filter(r => r.pass).length;
      console.log(`Before: ${pass}/${_beforeResults.length} passing`);
    } else {
      console.log('Before: not captured');
    }
    if (_afterResults) {
      const pass = _afterResults.filter(r => r.pass).length;
      console.log(`After: ${pass}/${_afterResults.length} passing`);
    } else {
      console.log('After: not captured');
    }
    console.groupEnd();
  }

  function reset() {
    _beforeResults = null;
    _afterResults = null;
    console.log('[DiffGuard] Reset — ready for new comparison');
  }

  return { before, after, status, reset };
})();
window.DiffGuard = DiffGuard;
