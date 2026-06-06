import { readFileSync } from 'fs';
const nodes = JSON.parse(readFileSync(new URL('../data/pledge-nodes.json', import.meta.url))).data;
console.log('Pledge nodes count:', nodes.length);
console.log('First node keys:', Object.keys(nodes[0]));
console.log('First node lat/lng:', nodes[0].lat, nodes[0].lng);
console.log('First node country:', nodes[0].country);
console.log('Sample nodes with missing lat/lng:');
const missing = nodes.filter(n => !n.lat || !n.lng);
console.log('Missing count:', missing.length);
if (missing.length > 0) {
  console.log('First missing:', missing[0].country, missing[0].iso);
}
