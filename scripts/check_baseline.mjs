import { readFileSync } from 'fs';
const nodes = JSON.parse(readFileSync(new URL('../data/pledge-nodes.json', import.meta.url))).data;

// Check if any nodes have baseline_year info
const withBaseline = nodes.filter(n => n.baseline_year || n.cw_baseline_year);
console.log('Nodes with baseline_year:', withBaseline.length);

// Check all unique fields
const allFields = new Set();
nodes.forEach(n => Object.keys(n).forEach(k => allFields.add(k)));
console.log('\nAll fields:', [...allFields].sort().join(', '));

// Check the ndc_summary for countries missing gap data - does it contain baseline year info?
console.log('\n=== NDC SUMMARIES FOR TOP MISSING GAP COUNTRIES ===');
const sorted = [...nodes].sort((a, b) => (b.fossil_co2_mt || 0) - (a.fossil_co2_mt || 0));
const missingGap = sorted.slice(0, 20).filter(n => n.reality_gap_mt === null || n.reality_gap_mt === undefined);

missingGap.forEach(n => {
  console.log(`\n${n.country} (${n.iso}):`);
  console.log(`  target: ${n.reduction_pct}% by ${Math.round(n.target_year)} type: ${n.target_type}`);
  console.log(`  ndc_summary: ${(n.ndc_summary || '').substring(0, 200)}`);
});
