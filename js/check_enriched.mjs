import { readFileSync } from 'fs';
const df = JSON.parse(readFileSync('/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet', 'utf8'));

// Check what fields are available in the enriched data
console.log('Enriched parquet columns:', Object.keys(df[0] || {}));

// Check a sample country with full data
const usa = df.find(r => r.country === 'United States' && r.year === 2024);
if (usa) {
  console.log('\n=== USA 2024 sample ===');
  Object.entries(usa).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') {
      console.log(`  ${k}: ${v}`);
    }
  });
}

// Check China
const china = df.find(r => r.country === 'China' && r.year === 2024);
if (china) {
  console.log('\n=== China 2024 sample ===');
  Object.entries(china).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') {
      console.log(`  ${k}: ${v}`);
    }
  });
}
