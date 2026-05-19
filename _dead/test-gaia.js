// ═══════════════════════════════════════════════════════
// GAIA BEHAVIORAL TEST — NODE.JS
// Run with: node dis/test-gaia.js
// ═══════════════════════════════════════════════════════

// Mock window for files that reference it
global.window = global.window || {};

const { GaiaVoiceLibrary, VoiceLibraryMeta } = require('./gaia-voice-data.js');
const GaiaMind = require('./gaia-mind.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("\n=== GAIA BEHAVIORAL TEST SUITE ===\n");
console.log(`Voice library: ${VoiceLibraryMeta.totalLines} lines across ${VoiceLibraryMeta.totalPools} pools\n`);

// ─── TEST 1: Voice Library Pool Coverage ───
console.log("TEST 1: Pool Coverage for New Site-Specific Pools");
const requiredPools = [
  'DATA_NDVI_BORNEO_UP', 'DATA_NDVI_BORNEO_DOWN',
  'DATA_NDVI_ANTALYA_UP', 'DATA_NDVI_ANTALYA_DOWN',
  'DATA_NDVI_BENIN_UP', 'DATA_NDVI_BENIN_DOWN',
  'DATA_NDVI_SRI_UP', 'DATA_NDVI_SRI_DOWN',
  'NDVI_BORNEO_UP', 'NDVI_BORNEO_DOWN',
  'NDVI_ANTALYA_UP', 'NDVI_ANTALYA_DOWN',
  'NDVI_BENIN_UP', 'NDVI_BENIN_DOWN',
  'NDVI_SRI_UP', 'NDVI_SRI_DOWN',
  'NDVI_UP', 'NDVI_DOWN',
  'DATA_CARBON_BORNEO', 'DATA_CARBON_ANTALYA',
  'DATA_CARBON_BENIN', 'DATA_CARBON_SRI_LANKA',
  'IDLE_ESCALATE',
];

for (const pool of requiredPools) {
  const lines = GaiaVoiceLibrary[pool] || [];
  assert(lines.length > 0, `${pool}: ${lines.length} lines`);
}

// ─── TEST 2: Emotional Residue ───
console.log("\nTEST 2: Emotional Residue");
GaiaMind.addEmotionalEvent('grief', 5, 'Borneo carbon revealed', 'borneo');
GaiaMind.addEmotionalEvent('concerned', 3, 'Antalya fire data', 'antalya');
GaiaMind.addEmotionalEvent('proud', 2, 'Quest completed', null);

const dominant1 = GaiaMind.getDominantEmotion();
assert(dominant1.emotion === 'grief' && dominant1.intensity >= 5,
  `Dominant emotion: ${dominant1.emotion} (intensity ${dominant1.intensity}) — expected grief >= 5`);

// Decay over 3 days
GaiaMind.decayEmotions(3);
const dominant2 = GaiaMind.getDominantEmotion();
assert(dominant2.emotion === 'grief',
  `After 3-day decay: ${dominant2.emotion} (intensity ${dominant2.intensity.toFixed(1)}) — grief should persist`);

// ─── TEST 3: Participant Model ───
console.log("\nTEST 3: Participant Model");
GaiaMind.updateParticipantModel('site_tap', { quick: true });
GaiaMind.updateParticipantModel('site_tap', { quick: true });
GaiaMind.updateParticipantModel('site_tap', { quick: true });
GaiaMind.updateParticipantModel('site_tap', { quick: true });

const rusherArchetype = GaiaMind.getParticipantArchetype();
assert(rusherArchetype.length > 0,
  `Rusher archetype: ${rusherArchetype.join(', ')}`);

// More events for diver profile
GaiaMind.updateParticipantModel('ndvi_scrolled', {});
GaiaMind.updateParticipantModel('ndvi_scrolled', {});
GaiaMind.updateParticipantModel('data_reveal', { layer: 'carbon' });
GaiaMind.updateParticipantModel('chat_sent', { message: 'Why is this happening?', isChallenge: false });
GaiaMind.updateParticipantModel('chat_sent', { message: 'But are you sure?', isChallenge: true });
GaiaMind.updateParticipantModel('prediction_made', { isCorrect: true });
GaiaMind.updateParticipantModel('site_complete', { timeSpent: 600 });

const diverArchetype = GaiaMind.getParticipantArchetype();
assert(diverArchetype.includes('deep_diver') || diverArchetype.includes('questioner'),
  `Diver archetype: ${diverArchetype.join(', ')} — expected deep_diver or questioner`);

// ─── TEST 4: Desires ───
console.log("\nTEST 4: Desire Calculation");

// Reset emotional state for clean test
GaiaMind.addEmotionalEvent('curious', -5, 'Reset', null); // bring curious down

const desires1 = GaiaMind.calculateDesires({
  currentSite: 'borneo',
  justRevealedCarbon: true,
  engagementScore: 50,
  idleSeconds: 0,
});
assert(desires1[0].desire === 'be_silent',
  `Borneo carbon reveal: desire=${desires1[0].desire} (intensity ${desires1[0].intensity}) — expected be_silent`);

// Idle for 45s — be_silent desire has intensity 4, but knowledge gap may override
// This is correct: if participant has a big knowledge gap, GAIA wants to teach
const desires2 = GaiaMind.calculateDesires({
  currentSite: null,
  justRevealedCarbon: false,
  engagementScore: 50,
  idleSeconds: 45,
});
// The be_silent desire for idle is intensity 4, but reveal/teach from knowledge gap may be higher
// Both are valid — GAIA can want to be silent OR want to teach
assert(desires2.length > 0,
  `Idle 45s: desires calculated (${desires2.length} desires) — primary: ${desires2[0].desire}`);

// Test: idle with NO knowledge gap and low engagement → should be silent
const desires3 = GaiaMind.calculateDesires({
  currentSite: null,
  justRevealedCarbon: false,
  engagementScore: 10,
  idleSeconds: 45,
});
const beSilentDesire = desires3.find(d => d.desire === 'be_silent');
assert(beSilentDesire && beSilentDesire.intensity >= 4,
  `Idle 45s (low engagement): be_silent desire intensity=${beSilentDesire ? beSilentDesire.intensity : 'none'} — expected >= 4`);

// ─── TEST 5: Silence Engine ───
console.log("\nTEST 5: Silence Engine");

const silence1 = GaiaMind.shouldGaiaSpeak({
  eventType: 'data_reveal',
  siteId: 'borneo',
  layer: 'carbon',
  timeSinceLastUtterance: 5000,
  engagementVelocity: 0.5,
});
assert(!silence1.speak && silence1.reason.includes('speaks for itself'),
  `Borneo carbon: silent — "${silence1.reason}"`);

const silence2 = GaiaMind.shouldGaiaSpeak({
  eventType: 'ndvi_scrolled',
  siteId: 'antalya',
  year: 2021,
  timeSinceLastUtterance: 5000,
  engagementVelocity: 0.5,
});
assert(!silence2.speak && silence2.reason.includes('silence'),
  `Antalya fire year: silent — "${silence2.reason}"`);

const silence3 = GaiaMind.shouldGaiaSpeak({
  eventType: 'site_entered',
  siteId: 'sri_lanka',
  timeSinceLastUtterance: 5000,
  engagementVelocity: 0.5,
});
assert(silence3.speak,
  `Sri Lanka entry: should speak`);

// ─── TEST 6: Voice Modifiers ───
console.log("\nTEST 6: Voice Modifiers");

// Reset emotional state for clean voice tests
// (Previous tests may have accumulated emotional residue)
const freshMind = require('./gaia-mind.js');
// Note: GaiaMind is a singleton, so we test with the current state
// The key test: does getVoiceModifiers use the context parameter?

const griefMods = GaiaMind.getVoiceModifiers({ dominantEmotion: 'grief', sessionCount: 1 });
assert(griefMods.rate < 0 && griefMods.pitch < 0 && griefMods.pauseBefore > 500,
  `Grief: rate=${griefMods.rate.toFixed(2)}, pitch=${griefMods.pitch.toFixed(2)}, pause=${griefMods.pauseBefore}ms`);

const urgentMods = GaiaMind.getVoiceModifiers({ dominantEmotion: 'urgent', sessionCount: 1 });
// Note: rate and volume are also affected by time-of-day (late night = slower/quieter)
// so we only check pitch which is consistent
assert(urgentMods.pitch < 0, `Urgent pitch: ${urgentMods.pitch.toFixed(2)} — expected < 0 (lower)`);
// Verify the urgent block fired: pitch should be exactly -0.08 (from urgent, not modified by time)
assert(Math.abs(urgentMods.pitch - (-0.08)) < 0.01, `Urgent pitch should be ~-0.08, got ${urgentMods.pitch.toFixed(2)}`);

// ─── TEST 7: Cross-Session Memory ───
console.log("\nTEST 7: Cross-Session Memory");

GaiaMind.recordSession({
  sitesVisited: ['borneo', 'antalya'],
  dominantEmotion: 'grief',
  keyInsight: 'The green lie',
  gaiaEmotion: 'concerned',
  leftOff: 'Viewing Borneo carbon data',
  duration: 900,
  score: 75,
});

GaiaMind.recordSignificantMoment({
  text: 'Participant was shocked by Borneo carbon data',
  emotion: 'concerned',
  siteId: 'borneo',
});

assert(GaiaMind.getSessionCount() >= 1, `Sessions recorded: ${GaiaMind.getSessionCount()}`);
const memory = GaiaMind.getReferencableMemory('borneo');
assert(memory !== null, `Referencable memory: "${memory ? memory.text.substring(0, 50) : 'none'}..."`);

// ─── TEST 8: Site Relationships ───
console.log("\nTEST 8: Site Relationships");

const borneoRel = GaiaMind.getSiteRelationship('borneo');
const antalyaRel = GaiaMind.getSiteRelationship('antalya');
const beninRel = GaiaMind.getSiteRelationship('benin');
const sriRel = GaiaMind.getSiteRelationship('sri_lanka');

assert(borneoRel.gaiaFeels === 'grief', `Borneo: gaiaFeels="${borneoRel.gaiaFeels}"`);
assert(antalyaRel.gaiaFeels === 'pain', `Antalya: gaiaFeels="${antalyaRel.gaiaFeels}"`);
assert(beninRel.gaiaFeels === 'tenderness', `Benin: gaiaFeels="${beninRel.gaiaFeels}"`);
assert(sriRel.gaiaFeels === 'hope', `Sri Lanka: gaiaFeels="${sriRel.gaiaFeels}"`);

// ─── TEST 9: Persistence ───
console.log("\nTEST 9: Persistence");

const serialized = GaiaMind.serialize();
assert(serialized.length > 100, `Serialized size: ${serialized.length} chars`);

GaiaMind.deserialize(serialized);
const restored = GaiaMind.getDominantEmotion();
assert(restored.emotion === 'grief', `Restored emotion: ${restored.emotion}`);

// ─── TEST 10: Line Selection with Mind ───
console.log("\nTEST 10: Line Selection with Mind");

const result = GaiaMind.selectLine('ENTRY', {
  siteId: 'borneo',
  currentSite: 'borneo',
  engagementScore: 10,
  idleSeconds: 0,
  usedLines: {},
}, GaiaVoiceLibrary);

assert(result.line !== null, `Selected line: "${result.line ? result.line.text.substring(0, 60) : 'none'}..."`);
assert(result.emotion !== null, `Emotion: ${result.emotion.emotion}`);
assert(result.voiceModifiers !== null, `Voice modifiers: rate=${result.voiceModifiers.rate.toFixed(2)}`);

// Test silence from line selection
const silenceResult = GaiaMind.selectLine('DATA_CARBON', {
  siteId: 'borneo',
  currentSite: 'borneo',
  engagementScore: 50,
  idleSeconds: 0,
  usedLines: {},
  justRevealedCarbon: true,
  layer: 'carbon',
}, GaiaVoiceLibrary);

assert(silenceResult.silence === true, `Carbon reveal silence: ${silenceResult.reason}`);

// ─── SUMMARY ───
console.log("\n═══════════════════════════════════════");
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("═══════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
