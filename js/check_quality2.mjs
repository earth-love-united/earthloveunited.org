import { readFileSync } from 'fs';
const nodes = JSON.parse(readFileSync('/Users/ekmelozdemir/earthloveunited.org/data/pledge-nodes.json'));

// Check the cw_ fields that were in the enriched parquet
console.log('=== SAMPLE NODE (USA) ===');
const usa = nodes.find(n => n.iso === 'USA');
Object.entries(usa).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// Check how many have cw_baseline_year
const hasBaseline = nodes.filter(n => {
  // Check if the enriched data had baseline_year
  return n.reality_gap_mt !== null && n.reality_gap_mt !== undefined;
});
console.log('\nCountries with reality_gap_mt:', hasBaseline.length);

// Check what target_type values exist
const targetTypes = {};
nodes.forEach(n => {
  const tt = n.target_type || 'null';
  targetTypes[tt] = (targetTypes[tt] || 0) + 1;
});
console.log('\n=== TARGET TYPE DISTRIBUTION ===');
Object.entries(targetTypes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v}`);
});

// Check conditionality values
const conds = {};
nodes.forEach(n => {
  const c = n.conditionality || 'null';
  conds[c] = (conds[c] || 0) + 1;
});
console.log('\n=== CONDITIONALITY DISTRIBUTION ===');
Object.entries(conds).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v}`);
});

// Check which top 50 emitters are missing gap data
const sorted = [...nodes].sort((a, b) => (b.fossil_co2_mt || 0) - (a.fossil_co2_mt || 0));
console.log('\n=== TOP 50 EMITTERS MISSING GAP DATA ===');
const missingGap = sorted.slice(0, 50).filter(n => n.reality_gap_mt === null || n.reality_gap_mt === undefined);
console.log('Count:', missingGap.length);
missingGap.forEach(n => {
  console.log(`  ${n.country.padEnd(25)} ${n.fossil_co2_mt.toFixed(0).padStart(8)} MtCO₂  target: ${n.reduction_pct || '?'}% by ${n.target_year || '?'}  type: ${n.target_type || 'N/A'}`);
});
