import { readFileSync } from 'fs';
const sites = JSON.parse(readFileSync(new URL('../data/sites.json', import.meta.url))).data;
console.log('Sites count:', sites.length);
console.log('First site keys:', Object.keys(sites[0]));
console.log('First site lat/lng:', sites[0].lat, sites[0].lng);
