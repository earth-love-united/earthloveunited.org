const sites = require('/Users/ekmelozdemir/earthloveunited.org/data/sites.json');
console.log('Sites count:', sites.length);
console.log('First site keys:', Object.keys(sites[0]));
console.log('First site lat/lng:', sites[0].lat, sites[0].lng);

const nodes = require('/Users/ekmelozdemir/earthloveunited.org/data/pledge-nodes.json');
console.log('Pledge nodes count:', nodes.length);
console.log('First node keys:', Object.keys(nodes[0]));
console.log('First node lat/lng:', nodes[0].lat, nodes[0].lng);
