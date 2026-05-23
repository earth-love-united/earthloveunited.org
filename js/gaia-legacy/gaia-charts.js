/**
 * GAIA CHARTS v1.1
 * Lightweight canvas chart renderer — zero dependencies
 * Charts are registered at creation time and rendered after DOM insertion
 */

const GAIA_CHARTS = (() => {
  const C = {
    teal: '#4ecdc4', mint: '#7be8d0', leaf: '#5bbf72',
    warn: '#c45c4a', amber: '#d4a574', violet: '#8b7fc7',
    text: '#9a9590', textDim: '#5a5652', grid: 'rgba(255,255,255,0.06)',
  };

  // Pending charts: array of { canvasId, fn, data, options }
  const pending = [];

  function onCanvasReady(id, fn, data, options) {
    pending.push({ id, fn, data, options });
  }

  // Call this after inserting HTML with chart canvases into the DOM
  function renderPending() {
    // Use rAF to ensure DOM is painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const stillPending = [];
        for (const p of pending) {
          const canvas = document.getElementById(p.id);
          if (!canvas) { stillPending.push(p); continue; }
          const rect = canvas.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) { stillPending.push(p); continue; }
          try { p.fn(canvas, p.data, p.options); } catch(e) { /* ignore render errors */ }
        }
        pending.length = 0;
        if (stillPending.length > 0) {
          // Retry next frame
          pending.push(...stillPending);
          setTimeout(renderPending, 100);
        }
      });
    });
  }

  // ── Sparkline ──
  function drawSparkline(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;

    const values = data.map(d => d.value);
    const min = Math.min(...values) - (options.padMin || 0);
    const max = Math.max(...values) + (options.padMax || 2);
    const range = max - min || 1;

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Line
    const color = options.color || C.teal;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * W;
      const y = H - ((d.value - min) / range) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '30'); grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // End dot
    const lastPt = data[data.length - 1];
    const lastX = W;
    const lastY = H - ((lastPt.value - min) / range) * H;
    ctx.beginPath(); ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();

    // Labels
    if (options.showLabels) {
      ctx.fillStyle = C.textDim; ctx.font = '8px monospace';
      ctx.textAlign = 'left'; ctx.fillText(data[0].label, 2, H - 4);
      ctx.textAlign = 'right'; ctx.fillText(data[data.length - 1].label, W - 2, H - 4);
      ctx.fillStyle = C.text;
      ctx.fillText(max.toFixed(1), W - 2, 10);
      ctx.fillText(min.toFixed(1), W - 2, H - 14);
    }
  }

  // ── Bar chart ──
  function drawBarChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...data.map(d => d.value)) * 1.1 || 1;
    const gap = 4;
    const barW = (W - gap) / data.length - gap;
    const colors = [C.teal, C.leaf, C.amber, C.warn, C.violet, C.mint];

    data.forEach((d, i) => {
      const x = gap + i * ((W - gap) / data.length);
      const barH = (d.value / maxVal) * (H - 18);
      const y = H - barH - 14;
      ctx.fillStyle = d.color || colors[i % colors.length];
      ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 2); ctx.fill();
      ctx.fillStyle = C.textDim; ctx.font = '7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, H - 2);
      ctx.fillStyle = C.text;
      const vs = d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'K' : d.value.toFixed(0);
      ctx.fillText(vs, x + barW / 2, y - 3);
    });
  }

  // ── Countdown bar ──
  function drawCountdownBar(canvas, data, options = {}) {
    const { remaining, total, label } = data;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    ctx.clearRect(0, 0, W, H);

    const pct = Math.min(remaining / total, 1);
    const barH = Math.max(6, H - 16);
    const y = (H - barH) / 2;

    ctx.fillStyle = C.grid;
    ctx.beginPath(); ctx.roundRect(0, y, W, barH, 3); ctx.fill();

    const color = pct > 0.5 ? C.leaf : pct > 0.2 ? C.amber : C.warn;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(0, y, W * pct, barH, 3); ctx.fill();

    ctx.fillStyle = C.text; ctx.font = '8px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label || `${remaining} / ${total}`, 2, y - 6);
  }

  // ── Donut ──
  function drawDonut(canvas, data, options = {}) {
    const { value, max, centerText, subText } = data;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    const cx = W / 2, cy = H / 2, radius = Math.min(W, H) / 2 - 4, lw = Math.max(4, Math.min(W, H) / 10);

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = C.grid; ctx.lineWidth = lw; ctx.stroke();

    const pct = Math.min(value / max, 1);
    const color = options.color || (pct > 0.7 ? C.warn : pct > 0.4 ? C.amber : C.leaf);
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();

    ctx.fillStyle = C.text; ctx.font = `bold ${Math.round(H / 4)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(centerText || `${Math.round(pct * 100)}%`, cx, cy - 3);
    if (subText) { ctx.fillStyle = C.textDim; ctx.font = `${Math.round(H / 9)}px monospace`; ctx.fillText(subText, cx, cy + H / 5); }
  }

  // ── HTML generators (register for deferred render) ──
  let _idCounter = 0;
  function nextId(prefix) { return `${prefix}-${++_idCounter}`; }

  function sparklineHTML(data, w = 240, h = 60, opts = {}) {
    const id = nextId('sp');
    onCanvasReady(id, drawSparkline, data, opts);
    return `<canvas id="${id}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;display:block;max-width:100%;"></canvas>`;
  }

  function barChartHTML(data, w = 240, h = 80) {
    const id = nextId('bar');
    onCanvasReady(id, drawBarChart, data, {});
    return `<canvas id="${id}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;display:block;max-width:100%;"></canvas>`;
  }

  function countdownBarHTML(remaining, total, w = 200, opts = {}) {
    const id = nextId('cd');
    onCanvasReady(id, drawCountdownBar, { remaining, total, label: opts.label }, {});
    return `<canvas id="${id}" width="${w}" height="28" style="width:${w}px;height:28px;display:block;max-width:100%;"></canvas>`;
  }

  function donutHTML(value, max, size = 60, opts = {}) {
    const id = nextId('donut');
    onCanvasReady(id, drawDonut, { value, max, centerText: opts.centerText, subText: opts.subText }, opts);
    return `<canvas id="${id}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;"></canvas>`;
  }

  return {
    sparklineHTML, barChartHTML, countdownBarHTML, donutHTML,
    renderPending, colors: C,
    _drawSparkline: drawSparkline, _drawBarChart: drawBarChart, _drawCountdownBar: drawCountdownBar, _drawDonut: drawDonut,
  };
})();
window.GAIA_CHARTS = GAIA_CHARTS;

  MODULE_CONTRACTS.register('GAIA_CHARTS', {
    provides: ['init', 'render', 'update', 'destroy'],
    requires: [],
  });
