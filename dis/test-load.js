// Mock window before any requires
global.window = global.window || {};

const { GaiaVoiceLibrary, VoiceLibraryMeta } = require('./gaia-voice-data.js');
const GaiaMind = require('./gaia-mind.js');
const GaiaState = require('./gaia-state-machine.js');

console.log('Voice library:', VoiceLibraryMeta.totalLines, 'lines,', VoiceLibraryMeta.totalPools, 'pools');
console.log('GaiaMind keys:', Object.keys(GaiaMind).length);
console.log('GaiaState keys:', Object.keys(GaiaState).length);
console.log('All DIS files load successfully in Node.js');
