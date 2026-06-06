import { readFileSync } from 'fs';
// Read the parquet as text to see if it's actually JSON
const raw = readFileSync(new URL('../carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet', import.meta.url), 'utf8');
console.log('First 200 chars:', raw.substring(0, 200));
console.log('Is JSON:', raw.trimStart().startsWith('['));
