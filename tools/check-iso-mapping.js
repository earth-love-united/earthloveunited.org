// Phase 0a: ISO Mapping Audit
// Run in browser console after page loads
// Checks overlap between pledge-nodes ISO codes and a sample of expected GeoJSON ISO_A3 values

function auditISOMapping() {
  if (typeof Data === 'undefined' || !Data.pledgeNodes) {
    console.error('[Audit] Data.pledgeNodes not available');
    return;
  }

  const pledgeISOs = new Set(Data.pledgeNodes.map(n => n.iso));
  const countries = GlobeModule.getCountryFeatures();

  if (!countries || !countries.length) {
    console.error('[Audit] Country GeoJSON not loaded yet — run again after globe init');
    return;
  }

  const geoISOs = new Set(countries.map(f => f.properties.ISO_A3).filter(Boolean));

  // Check: which pledge ISOs have a matching GeoJSON feature?
  let matched = 0, unmatched = 0;
  const unmatchedList = [];
  pledgeISOs.forEach(iso => {
    if (geoISOs.has(iso)) {
      matched++;
    } else {
      unmatched++;
      unmatchedList.push(iso);
    }
  });

  console.log(`[Audit] Pledge nodes: ${pledgeISOs.size} countries`);
  console.log(`[Audit] GeoJSON features: ${geoISOs.size} countries`);
  console.log(`[Audit] Matched: ${matched}/${pledgeISOs.size}`);
  console.log(`[Audit] Unmatched (${unmatched}):`, unmatchedList.join(', '));

  // Spot check USA
  const usa = countries.find(f => f.properties.ISO_A3 === 'USA');
  if (usa) {
    const usaData = Data.pledgeNodes.find(n => n.iso === 'USA');
    console.log('[Audit] USA GeoJSON:', usa.properties.ISO_A3, usa.properties.ADMIN);
    console.log('[Audit] USA pledge:', usaData.country, 'gap:', usaData.reality_gap_mt, 'color:', usaData.globe_color);
  }

  // Sample a few more
  ['CHN', 'IND', 'BRA', 'RUS', 'DEU', 'GBR', 'FRA', 'JPN', 'AUS', 'CAN'].forEach(iso => {
    const geo = countries.find(f => f.properties.ISO_A3 === iso);
    const pledge = Data.pledgeNodes.find(n => n.iso === iso);
    console.log(`[Audit] ${iso}: geo=${!!geo} pledge=${!!pledge} ${pledge ? pledge.country : ''}`);
  });
}

auditISOMapping();
