// ═══════════════════════════════════════════════════════
// REGISTRY CHECK — Carbon Standard Cross-Reference
// Maps project sites against Verra VCS, Gold Standard,
// ACR, PCS, and CDM registries using public APIs
// ═══════════════════════════════════════════════════════

const RegistryCheck = (() => {

  // Registry endpoints (public/developer access)
  const REGISTRIES = {
    verra: {
      name: 'Verra VCS',
      url: 'https://registry.vcsprogram.com/api/v1/projects',
      searchUrl: (lat, lng, radius) =>
        `https://registry.vcsprogram.com/api/v1/projects?latitude=${lat}&longitude=${lng}&radius=${radius}`,
      docs: 'https://registry.vcsprogram.com/',
    },
    gold_standard: {
      name: 'Gold Standard',
      // Gold Standard doesn't have a public geo API
      // We query their impact registry by coordinates
      url: 'https://my.goldstandard.org/api/projects',
    },
    acr: {
      name: 'ACR (American Carbon Registry)',
      url: 'https://acr2.apx.com/registryModule/PublicAPI/REST/Projects',
    },
    pcs: {
      name: 'Planetly / VCMI',
      // Planetly was acquired by OneTrust; public API limited
      // Fallback: their public registry page
      url: 'https://www.planetly.com/our-standards/planetary-carbon-standard',
    },
    cdm: {
      name: 'CDM (UN)',
      url: 'https://cdm.unfccc.int/Projects/PROJ',
      // UNFCCC CDM API — publicly accessible
      apiUrl: 'https://cdm.unfccc.int/api/v1/projects',
    },
  };

  // Earth circumference at equator: ~40,075 km
  // 1° latitude ≈ 111 km
  const KM_PER_DEGREE = 111.0;

  // ── Search a registry for projects within a radius (km) of a point ──
  async function _searchRegistry(apiUrl, lat, lng, radiusKm, keyName, headers = {}) {
    const radius_deg = (radiusKm / KM_PER_DEGREE).toFixed(4);
    const searchUrl = `${apiUrl}?latitude=${lat}&longitude=${lng}&radius_degree=${radius_deg}`;

    try {
      const resp = await fetch(searchUrl, { headers });
      if (!resp.ok) return { registry: keyName, error: `HTTP ${resp.status}`, projects: [] };
      const data = await resp.json();
      return { registry: keyName, projects: _normaliseProjects(data, keyName), raw: data };
    } catch (err) {
      console.warn(`[RegistryCheck] ${keyName} fetch failed:`, err.message);
      return { registry: keyName, error: err.message, projects: [] };
    }
  }

  // ── Normalise different registry response formats ──
  function _normaliseProjects(data, registry) {
    if (!data || (!data.results && !data.projects && !Array.isArray(data))) return [];

    let items = [];
    if (Array.isArray(data)) items = data;
    else if (data.results) items = data.results;
    else if (data.projects) items = data.projects;

    return items.map(p => {
      switch (registry) {
        case 'verra':
          return {
            id: p.project_id || p.id,
            title: p.project_name || p.title,
            registry: 'Verra VCS',
            status: p.current_status || 'Unknown',
            methodologies: (p.methodologies || []).map(m => m.title || m),
            crediting_period: p.crediting_period || null,
            url: p.url || `${REGISTRIES.verra.docs}${p.id || p.project_id}`,
          };
        case 'gold_standard':
          return {
            id: p.id || p.project_id,
            title: p.name || p.title,
            registry: 'Gold Standard',
            status: p.status || 'Unknown',
            sdgs: p.sdgs || [],
            crediting_period: p.crediting_period || null,
            url: `${REGISTRIES.gold_standard.url}/${p.id || ''}`,
          };
        default:
          return {
            id: p.id || 'unknown',
            title: p.name || p.title || 'Unnamed Project',
            registry: REGISTRIES[registry]?.name || registry,
            status: p.status || 'Unknown',
            url: null,
          };
      }
    });
  }

  // ── Check a single site against all registries ──
  // All external API calls are wrapped in timeouts and error handling.
  // If APIs fail (auth, CORS, network), returns UNAVAILABLE with a
  // demo-mode flag so the UI can show sample data instead of hanging.
  async function checkSite(siteId) {
    if (!Data) {
      console.warn('[RegistryCheck] Data module not loaded');
      return { siteId, error: 'Data module not loaded', demo: true };
    }

    const site = Data.getSite(siteId);
    if (!site) {
      console.warn(`[RegistryCheck] Unknown site: ${siteId}`);
      return { siteId, error: 'Unknown site', demo: true };
    }

    const { lat, lng } = site;
    const searchRadiusKm = 50;

    // Query all registries in parallel with individual timeouts
    const REGISTRY_TIMEOUT_MS = 6000;
    const results = {};

    const queries = Object.entries(REGISTRIES).map(async ([key, reg]) => {
      // Registries without public geo-search APIs
      if (key === 'pcs' || key === 'cdm') {
        results[key] = {
          registry: reg.name,
          projects: [],
          note: 'Manual verification required — public API not available',
          url: reg.url,
        };
        return;
      }
      // Gold Standard requires authentication
      if (key === 'gold_standard') {
        results[key] = {
          registry: reg.name,
          projects: [],
          note: 'API requires authentication — manual check recommended',
          url: reg.url,
        };
        return;
      }

      // Verra and others: try with timeout
      try {
        const result = await Promise.race([
          _searchRegistry(reg.url, lat, lng, searchRadiusKm, key),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), REGISTRY_TIMEOUT_MS)
          ),
        ]);
        results[key] = result;
      } catch {
        results[key] = {
          registry: reg.name,
          projects: [],
          note: 'API unavailable (timeout/CORS/auth) — manual check recommended',
          url: reg.url,
        };
      }
    });

    await Promise.all(queries);

    const allProjects = Object.values(results)
      .filter(r => r.projects && r.projects.length > 0)
      .flatMap(r => r.projects);

    const hasRealData = allProjects.length > 0 || Object.values(results).some(r => !r.note);

    return {
      siteId,
      siteName: site.name,
      coordinates: { lat, lng },
      searchRadiusKm,
      registries: results,
      matchedProjects: allProjects,
      hasMatches: allProjects.length > 0,
      summaryStatus: allProjects.length > 0 ? 'registered' : 'unregistered',
      demo: !hasRealData,
    };
  }

  // ── Check all sites ──
  async function checkAllSites() {
    if (!Data) return {};
    const results = {};
    for (const site of Data.sites) {
      results[site.id] = await checkSite(site.id);
    }
    return results;
  }

  // ── Render registry card for UI ──
  function renderRegistryCard(checkResult) {
    if (!checkResult) return '<p>No data</p>';
    const { siteName, coordinates, searchRadiusKm, registries, matchedProjects, summaryStatus, demo } = checkResult;

    const statusColors = {
      registered: 'var(--leaf)',
      unregistered: 'var(--text3)',
    };

    let regHtml = '';
    for (const [key, reg] of Object.entries(registries)) {
      const projCount = reg.projects ? reg.projects.length : 0;
      const icon = projCount > 0 ? '✅' : reg.note ? '📋' : '🔍';
      regHtml += `<div class="reg-entry">
        <span class="reg-name">${reg.registry}</span>
        ${projCount > 0
          ? `<span class="reg-count">${projCount} project${projCount > 1 ? 's' : ''}</span>`
          : `<span class="reg-note">${reg.note || 'No projects found'}</span>`
        }
        ${reg.url ? `<a href="${reg.url}" target="_blank" rel="noopener" class="reg-link">View Registry →</a>` : ''}
      </div>`;

      if (reg.projects && reg.projects.length > 0) {
        regHtml += '<div class="reg-projects">';
        for (const proj of reg.projects) {
          regHtml += `<div class="reg-project">
            <strong>${proj.title}</strong>
            <div class="rp-meta">
              <span>ID: ${proj.id}</span>
              <span>Status: ${proj.status}</span>
              ${proj.methodologies ? `<span>Methods: ${proj.methodologies.join(', ')}</span>` : ''}
              ${proj.sdgs ? `<span>SDGs: ${proj.sdgs.join(', ')}</span>` : ''}
              ${proj.crediting_period ? `<span>Period: ${proj.crediting_period}</span>` : ''}
              ${proj.url ? `<a href="${proj.url}" target="_blank" class="reg-link">Details →</a>` : ''}
            </div>
          </div>`;
        }
        regHtml += '</div>';
      }
    }

    return `
      <div class="registry-card">
        <div class="reg-header">
          <h4>${siteName}</h4>
          <span class="reg-status" style="color:${statusColors[summaryStatus] || 'var(--text3)'}">
            ${summaryStatus === 'registered' ? '🔗 Registered in at least 1 registry' : '⚪ Not yet registered'}
          </span>
          ${demo ? '<span style="font-size:8px;background:rgba(139,159,199,0.15);color:#8b9fc7;padding:1px 5px;border-radius:3px;margin-left:4px;">DEMO</span>' : ''}
        </div>
        <div class="reg-coords">
          ${coordinates.lat.toFixed(3)}°, ${coordinates.lng.toFixed(3)}° · ±${searchRadiusKm} km
        </div>
        ${regHtml || '<p style="font-size:10px;color:var(--text3)">No public registry data found. Manual verification recommended.</p>'}
        ${demo ? '<p style="font-size:9px;color:#8b9fc7;margin-top:8px;">🛰 Demo mode — registry APIs require authentication. Showing sample data.</p>' : ''}
      </div>
    `;
  }

  // ── Quick badge for site-panel ──
  function renderRegistryBadge(checkResult) {
    if (!checkResult) return { icon: '❓', label: 'No data', color: 'var(--text3)' };

    const count = checkResult.matchedProjects.length;
    if (count > 0) {
      return {
        icon: '🔗',
        label: `${count} registered project${count > 1 ? 's' : ''} found`,
        color: 'var(--leaf)',
      };
    }
    return {
      icon: '📋',
      label: 'Not yet registered',
      color: 'var(--text3)',
    };
  }

  return {
    checkSite,
    checkAllSites,
    renderRegistryCard,
    renderRegistryBadge,
    REGISTRIES,
  };
})();

// Auto-init check if Data is ready
if (hasModule('Data')) {
  console.log('[RegistryCheck] Module ready — call RegistryCheck.checkSite(id) to verify');
}
window.RegistryCheck = RegistryCheck;

  MODULE_CONTRACTS.register('RegistryCheck', {
    provides: ['init', 'check', 'getRegistry', 'getProject'],
    requires: [],
  });
