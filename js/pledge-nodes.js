/**
 * PLEDGE NODES v1.0
 * Registers all 123 countries from pledge-nodes.json into the GLOBE_OVERLAY.
 * Each country gets a "Pledge vs Reality" dashboard in the left-side overlay.
 *
 * Data source: data/pledge-nodes.json (generated from pledge_vs_reality_enriched.parquet)
 */

const PLEDGE_NODES = (() => {
  let _nodes = [];

  // ── Load pledge node data ──
  async function load() {
    try {
      const resp = await fetch('data/pledge-nodes.json');
      _nodes = await resp.json();
      registerAll();
      console.log('[PLEDGE_NODES] Registered', _nodes.length, 'countries');
    } catch (err) {
      console.warn('[PLEDGE_NODES] Failed to load pledge-nodes.json:', err);
    }
  }

  // ── Register all countries into GLOBE_OVERLAY ──
  function registerAll() {
    if (typeof GLOBE_OVERLAY === 'undefined') {
      console.warn('[PLEDGE_NODES] GLOBE_OVERLAY not available, skipping registration');
      return;
    }
    _nodes.forEach(node => {
      GLOBE_OVERLAY.registerSite({
        siteId: 'pledge_' + node.iso,
        icon: '🌐',
        title: node.country,
        subtitle: formatSubtitle(node),
        siteData: node,
        tabs: [
          { id: 'dashboard', label: 'Dashboard', render: renderDashboard },
          { id: 'pledge',    label: 'Pledge',     render: renderPledge },
          { id: 'context',   label: 'Context',    render: renderContext },
        ],
      });
    });
  }

  function formatSubtitle(node) {
    const parts = [];
    if (node.reduction_pct > 0) parts.push(node.reduction_pct + '% by ' + Math.round(node.target_year));
    if (node.conditionality) parts.push(node.conditionality);
    if (node.cat_rating) parts.push(node.cat_rating);
    return parts.join(' · ');
  }

  // ── Format helpers ──
  function fmt(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return typeof n === 'number' ? n.toFixed(1) : String(n);
  }

  function fmtInt(n) {
    if (n === null || n === undefined) return '—';
    return Math.round(n).toLocaleString();
  }

  // ── Dashboard tab render ──
  function renderDashboard(el, node) {
    if (!node) return;
    const gap = node.reality_gap_mt;
    const gapClass = gap === null ? '' : (gap > 0 ? 'red' : 'green');
    const gapSign = gap !== null && gap > 0 ? '+' : '';
    const onTrack = node.on_track || '';
    const mom = node.momentum_cagr;
    const momClass = mom > 0 ? 'red' : 'green';

    let html = '';

    // CAT rating badge
    if (node.cat_rating) {
      html += '<div class="pledge-cat-badge" style="background:' + (node.globe_color || '#95a5a6') + '22;border-color:' + (node.globe_color || '#95a5a6') + '">';
      html += '<span class="pledge-cat-dot" style="background:' + (node.globe_color || '#95a5a6') + '"></span>';
      html += node.cat_rating;
      html += '</div>';
    }

    // Reality Gap card
    html += '<div class="pledge-gap-card">';
    html += '<div class="pledge-big-number">' + fmt(node.fossil_co2_mt) + ' <span class="pledge-unit">MtCO₂</span></div>';
    html += '<div class="pledge-label">Current Fossil Emissions</div>';
    if (gap !== null) {
      html += '<div class="pledge-gap-metric ' + gapClass + '">Gap to Target: ' + gapSign + fmt(gap) + ' MtCO₂</div>';
    } else {
      html += '<div class="pledge-gap-metric">No target data available</div>';
    }
    html += '</div>';

    // Emissions breakdown
    html += '<div class="pledge-emit-grid">';
    html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + fmt(node.fossil_co2_mt) + '</div><div class="pledge-emit-label">Fossil CO₂ (Mt)</div></div>';
    html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + fmt(node.lulucf_co2_mt) + '</div><div class="pledge-emit-label">LULUCF CO₂ (Mt)</div></div>';
    html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + fmt(node.total_co2_mt) + '</div><div class="pledge-emit-label">Total CO₂ (Mt)</div></div>';
    html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + (node.co2_per_capita > 0 ? node.co2_per_capita.toFixed(2) : '—') + '</div><div class="pledge-emit-label">Per Capita (t)</div></div>';
    html += '</div>';

    // Momentum
    html += '<div class="pledge-momentum">';
    html += '<div class="pledge-momentum-actual ' + momClass + '">';
    html += '<div class="pledge-momentum-label">Actual Velocity</div>';
    html += '<div class="pledge-momentum-val">' + (mom > 0 ? '+' : '') + mom.toFixed(2) + '%/yr</div>';
    html += '</div>';
    if (node.required_cagr > 0) {
      html += '<div class="pledge-momentum-vs">vs</div>';
      html += '<div class="pledge-momentum-required">';
      html += '<div class="pledge-momentum-label">Required Velocity</div>';
      html += '<div class="pledge-momentum-val">-' + node.required_cagr.toFixed(2) + '%/yr</div>';
      html += '</div>';
    }
    html += '</div>';
    if (node.divergence !== null && node.divergence !== undefined && node.divergence !== 0) {
      const divClass = node.divergence > 0 ? 'red' : 'green';
      html += '<div class="pledge-divergence ' + divClass + '">Divergence: ' + (node.divergence > 0 ? '+' : '') + node.divergence.toFixed(2) + '%/yr</div>';
    }

    // Change since 2015
    if (node.change_since_2015 !== null && node.change_since_2015 !== undefined) {
      const chg = node.change_since_2015;
      const chgClass = chg > 0 ? 'red' : 'green';
      html += '<div class="pledge-change ' + chgClass + '">Since 2015: ' + (chg > 0 ? '+' : '') + chg.toFixed(1) + '%</div>';
    }

    // On track
    if (onTrack === 'true') {
      html += '<div class="pledge-on-track green">✓ On Track</div>';
    } else if (onTrack === 'false') {
      html += '<div class="pledge-on-track red">✗ Off Track</div>';
    }

    el.innerHTML = html;
  }

  // ── Pledge tab render ──
  function renderPledge(el, node) {
    if (!node) return;
    let html = '';

    html += '<div class="pledge-section">';
    html += '<div class="pledge-section-title">NDC Target</div>';
    html += '<div class="pledge-detail-row"><span class="pledge-detail-label">Target Year</span><span class="pledge-detail-val">' + (node.target_year > 0 ? Math.round(node.target_year) : '—') + '</span></div>';
    html += '<div class="pledge-detail-row"><span class="pledge-detail-label">Reduction</span><span class="pledge-detail-val">' + (node.reduction_pct > 0 ? node.reduction_pct + '%' : '—') + '</span></div>';
    html += '<div class="pledge-detail-row"><span class="pledge-detail-label">Target Type</span><span class="pledge-detail-val">' + (node.target_type || '—') + '</span></div>';
    html += '<div class="pledge-detail-row"><span class="pledge-detail-label">Conditionality</span><span class="pledge-detail-val">' + (node.conditionality || '—') + '</span></div>';
    if (node.implied_target_mt > 0) {
      html += '<div class="pledge-detail-row"><span class="pledge-detail-label">Implied Target</span><span class="pledge-detail-val">' + fmt(node.implied_target_mt) + ' MtCO₂e</span></div>';
    }
    html += '</div>';

    // Finance
    if (node.finance_total_bn > 0) {
      html += '<div class="pledge-section">';
      html += '<div class="pledge-section-title">Climate Finance</div>';
      html += '<div class="pledge-finance-total">$' + fmt(node.finance_total_bn) + 'B</div>';
      html += '<div class="pledge-finance-label">Target Conditional on International Finance</div>';
      if (node.finance_mitigation_bn > 0) {
        html += '<div class="pledge-finance-breakdown">Mitigation: $' + fmt(node.finance_mitigation_bn) + 'B · Adaptation: $' + fmt(node.finance_adaptation_bn) + 'B</div>';
      }
      html += '</div>';
    }

    // NDC Summary
    if (node.ndc_summary) {
      html += '<div class="pledge-section">';
      html += '<div class="pledge-section-title">NDC Summary</div>';
      html += '<div class="pledge-ndc-text">' + node.ndc_summary + '</div>';
      html += '</div>';
    }

    el.innerHTML = html;
  }

  // ── Context tab render ──
  function renderContext(el, node) {
    if (!node) return;
    let html = '';

    html += '<div class="pledge-section">';
    html += '<div class="pledge-section-title">Country Profile</div>';
    html += '<div class="pledge-detail-row"><span class="pledge-detail-label">Population</span><span class="pledge-detail-val">' + fmtInt(node.population) + '</span></div>';
    html += '<div class="pledge-detail-row"><span class="pledge-detail-label">CO₂ per Capita</span><span class="pledge-detail-val">' + (node.co2_per_capita > 0 ? node.co2_per_capita.toFixed(2) + ' t' : '—') + '</span></div>';
    html += '<div class="pledge-detail-row"><span class="pledge-detail-label">Fossil CO₂</span><span class="pledge-detail-val">' + fmt(node.fossil_co2_mt) + ' Mt</span></div>';
    html += '<div class="pledge-detail-row"><span class="pledge-detail-label">LULUCF CO₂</span><span class="pledge-detail-val">' + fmt(node.lulucf_co2_mt) + ' Mt</span></div>';
    html += '<div class="pledge-detail-row"><span class="pledge-detail-label">Total CO₂</span><span class="pledge-detail-val">' + fmt(node.total_co2_mt) + ' Mt</span></div>';
    html += '</div>';

    if (node.cat_rating) {
      html += '<div class="pledge-section">';
      html += '<div class="pledge-section-title">Climate Action Tracker</div>';
      html += '<div class="pledge-cat-badge" style="background:' + (node.globe_color || '#95a5a6') + '22;border-color:' + (node.globe_color || '#95a5a6') + '">';
      html += '<span class="pledge-cat-dot" style="background:' + (node.globe_color || '#95a5a6') + '"></span>';
      html += node.cat_rating;
      html += '</div>';
      html += '</div>';
    }

    el.innerHTML = html;
  }

  // ── Open overlay for a country ──
  function openCountry(iso) {
    if (typeof GLOBE_OVERLAY === 'undefined') return;
    const siteId = 'pledge_' + iso;
    if (GLOBE_OVERLAY.getSite(siteId)) {
      GLOBE_OVERLAY.open(siteId);
    } else {
      // Data not loaded yet — try again after a short delay
      console.warn('[PLEDGE_NODES] Country not yet registered, retrying...', iso);
      setTimeout(() => {
        if (GLOBE_OVERLAY.getSite(siteId)) {
          GLOBE_OVERLAY.open(siteId);
        } else {
          console.error('[PLEDGE_NODES] Country registration failed:', iso);
        }
      }, 500);
    }
  }

  // ── Get node by ISO ──
  function getNode(iso) {
    return _nodes.find(n => n.iso === iso) || null;
  }

  // ── Get all nodes ──
  function getAll() { return _nodes; }

  return { load, openCountry, getNode, getAll };
})();

// Auto-load on script load
PLEDGE_NODES.load();
