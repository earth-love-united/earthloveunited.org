import { readFileSync } from 'fs';
const nodes = JSON.parse(readFileSync('/Users/ekmelozdemir/earthloveunited.org/data/pledge-nodes.json'));

console.log('Total countries:', nodes.length);
console.log('');

// Check coverage of key fields
const fields = [
  'country', 'iso', 'lat', 'lng', 'fossil_co2_mt', 'lulucf_co2_mt', 'total_co2_mt',
  'co2_per_capita', 'population', 'cat_rating', 'cat_score', 'globe_color',
  'target_type', 'reduction_pct', 'target_year', 'implied_target_mt',
  'reality_gap_mt', 'momentum_cagr', 'required_cagr', 'divergence',
  'on_track', 'change_since_2015', 'finance_mitigation_bn', 'finance_adaptation_bn',
  'finance_total_bn', 'conditionality', 'ndc_summary'
];

console.log('=== FIELD COVERAGE ===');
for (const f of fields) {
  const has = nodes.filter(n => n[f] !== null && n[f] !== undefined && n[f] !== '').length;
  const pct = (has / nodes.length * 100).toFixed(1);
  console.log(`  ${f.padEnd(25)} ${String(has).padStart(3)}/${nodes.length} (${pct}%)`);
}

// Check for countries with no target data at all
const noTarget = nodes.filter(n => !n.reduction_pct && !n.target_year && !n.target_type);
console.log('\n=== COUNTRIES WITH NO TARGET DATA ===');
console.log('Count:', noTarget.length);
noTarget.slice(0, 10).forEach(n => console.log(`  ${n.country} (${n.iso})`));

// Check for countries with target but no baseline
const noBaseline = nodes.filter(n => n.reduction_pct > 0 && !n.target_year);
console.log('\n=== COUNTRIES WITH REDUCTION % BUT NO TARGET YEAR ===');
console.log('Count:', noBaseline.length);
noBaseline.slice(0, 10).forEach(n => console.log(`  ${n.country} (${n.iso}): ${n.reduction_pct}%`));

// Check top emitters
console.log('\n=== TOP 20 EMITTERS ===');
const sorted = [...nodes].sort((a, b) => (b.fossil_co2_mt || 0) - (a.fossil_co2_mt || 0));
sorted.slice(0, 20).forEach((n, i) => {
  const target = n.reduction_pct > 0 ? `${n.reduction_pct}% by ${Math.round(n.target_year)}` : 'NO TARGET';
  const gap = n.reality_gap_mt !== null ? `${n.reality_gap_mt > 0 ? '+' : ''}${n.reality_gap_mt.toFixed(0)} Mt` : 'N/A';
  console.log(`  ${(i+1).toString().padStart(2)}. ${n.country.padEnd(25)} ${n.fossil_co2_mt.toFixed(0).padStart(8)} MtCO₂  target: ${target.padEnd(20)} gap: ${gap}`);
});
