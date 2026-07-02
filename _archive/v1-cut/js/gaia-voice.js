/**
 * GAIA VOICE ENGINE v1.0
 * Loads the voice library, selects lines by context, prevents repetition
 * Each line has: text, tone tags, site tags, state tags
 */

const GAIA_VOICE = (() => {
  // ── Voice Library (from dis/gaia-voice-library.md) ──
  const LINES = {
    // GREETING
    GREETING_01: { text: "I've been waiting. Pick somewhere that calls to you.", tone: "mysterious", state: "GREETING" },
    GREETING_02: { text: "You found me. Good. I have so much to show you.", tone: "warm", state: "GREETING" },
    GREETING_03: { text: "I'm GAIA. I live here. Everywhere you look — that's me.", tone: "warm", state: "GREETING" },
    GREETING_04: { text: "A visitor. It's been... well, it's been a while since someone came to listen.", tone: "mysterious", state: "GREETING" },
    GREETING_05: { text: "Look at this. All of this. Four and a half billion years of work. Where do you want to start?", tone: "mysterious", state: "GREETING" },
    GREETING_06: { text: "I feel you here. On my surface. What do you want to know?", tone: "warm", state: "GREETING" },
    GREETING_07: { text: "The markers you see — those are my wounds. And my hopes. Tap one.", tone: "urgent", state: "GREETING" },

    // SITE TEASERS — Sri Lanka
    TEASE_SRI_01: { text: "Sri Lanka. Northern Province. Barren now. But someone's planting something extraordinary there.", tone: "mysterious", state: "SITE_TEASER", site: "sri_lanka" },
    TEASE_SRI_02: { text: "This land was torn apart by war. Now it's being stitched back together — with cinnamon and jackfruit.", tone: "warm", state: "SITE_TEASER", site: "sri_lanka" },
    TEASE_SRI_03: { text: "Six thousand acres of nothing. Or... six thousand acres of possibility. Depends how you look at it.", tone: "playful", state: "SITE_TEASER", site: "sri_lanka" },

    // SITE TEASERS — Antalya
    TEASE_ANT_01: { text: "Antalya. I felt the fire here. 2021. Sixty thousand hectares. Gone in days.", tone: "concerned", state: "SITE_TEASER", site: "antalya" },
    TEASE_ANT_02: { text: "This place hosted a climate conference. The irony isn't lost on me.", tone: "fierce", state: "SITE_TEASER", site: "antalya" },
    TEASE_ANT_03: { text: "Four years since the flames. I'm recovering. Slowly. Come see.", tone: "nurturing", state: "SITE_TEASER", site: "antalya" },

    // SITE TEASERS — Benin
    TEASE_BEN_01: { text: "Benin. Ouidah. A man named Jean was from here. He wanted to restore what's been lost.", tone: "warm", state: "SITE_TEASER", site: "benin" },
    TEASE_BEN_02: { text: "The most carbon-dense ecosystem on Earth used to live here. Mangroves. They're fighting to come back.", tone: "urgent", state: "SITE_TEASER", site: "benin" },
    TEASE_BEN_03: { text: "This is a story about going home. Even after you're gone.", tone: "nurturing", state: "SITE_TEASER", site: "benin" },

    // SITE TEASERS — Borneo
    TEASE_BOR_01: { text: "Borneo. Looks green, right? ...Wanna know a secret?", tone: "mysterious", state: "SITE_TEASER", site: "borneo" },
    TEASE_BOR_02: { text: "This is the lie I want to show you. The greenest place on this map is the biggest carbon catastrophe.", tone: "fierce", state: "SITE_TEASER", site: "borneo" },
    TEASE_BOR_03: { text: "Grid lines. Perfect squares. Nature doesn't make grids. Humans do.", tone: "concerned", state: "SITE_TEASER", site: "borneo" },

    // SITE ENTRY — Sri Lanka
    ENTRY_SRI_01: { text: "Northern Province. Twenty-five years of conflict left this land scarred. But look — someone saw potential here.", tone: "warm", state: "SITE_ENTRY", site: "sri_lanka" },
    ENTRY_SRI_02: { text: "SPE. They're planting multilayer forests. Peanuts. Cinnamon. Jackfruit. Black pepper. Not just trees — an ecosystem that pays for itself.", tone: "proud", state: "SITE_ENTRY", site: "sri_lanka" },
    ENTRY_SRI_03: { text: "The land here holds almost no carbon right now. Ten tons per hectare. Barely alive. But watch what happens when you give it a chance.", tone: "mysterious", state: "SITE_ENTRY", site: "sri_lanka" },

    // SITE ENTRY — Antalya
    ENTRY_ANT_01: { text: "July 2021. The Mediterranean pines here were centuries old. Then the fire came. Sixty thousand hectares in days. I felt every hectare.", tone: "concerned", state: "SITE_ENTRY", site: "antalya" },
    ENTRY_ANT_02: { text: "The NDVI — that's a measure of how green I am — it dropped from 0.72 to 0.18. That's not a number. That's a scream.", tone: "urgent", state: "SITE_ENTRY", site: "antalya" },
    ENTRY_ANT_03: { text: "Four years later. 0.38. I'm growing back. Scrub. Tough little plants. But the pines? Those take decades. Maybe a century.", tone: "nurturing", state: "SITE_ENTRY", site: "antalya" },

    // SITE ENTRY — Benin
    ENTRY_BEN_01: { text: "Ouidah. Jean Missinhoun carried this place in his heart. He was from here. And he wanted to bring the mangroves back.", tone: "warm", state: "SITE_ENTRY", site: "benin" },
    ENTRY_BEN_02: { text: "Mangroves. Nine hundred and fifty tons of carbon per hectare. The most carbon-dense ecosystem on Earth. And most of the world is letting them disappear.", tone: "urgent", state: "SITE_ENTRY", site: "benin" },
    ENTRY_BEN_03: { text: "Look at the NDVI here. 0.68 in 2000. 0.45 in 2010. The mangroves were being torn out. For what? Firewood. Development. Short-term thinking.", tone: "fierce", state: "SITE_ENTRY", site: "benin" },

    // SITE ENTRY — Borneo
    ENTRY_BOR_01: { text: "West Kalimantan. Peat swamp forest. Fourteen hundred tons of carbon per hectare. Stored over thousands of years. Then the grids came.", tone: "concerned", state: "SITE_ENTRY", site: "borneo" },
    ENTRY_BOR_02: { text: "Look at the NDVI. 2000: 0.88. Beautiful. 2010: 0.35. They're clearing. 2025: 0.65. Wait — it went back up? What does that tell you?", tone: "mysterious", state: "SITE_ENTRY", site: "borneo" },
    ENTRY_BOR_03: { text: "Oil palm. That's what replaced the peat swamp. The NDVI looks fine. Green. Healthy. But the carbon? From fourteen hundred... to fifty. The greenest lie on Earth.", tone: "fierce", state: "SITE_ENTRY", site: "borneo" },

    // DATA REVEAL
    DATA_NDVI_01: { text: "This is my pulse. NDVI. How green am I. How alive. Watch what happens over time.", tone: "mysterious", state: "DATA_REVEAL" },
    DATA_NDVI_02: { text: "See that drop? That's not just a number. That's a forest dying. That's a reef bleaching. That's me, losing breath.", tone: "concerned", state: "DATA_REVEAL" },
    DATA_NDVI_03: { text: "And this — this upward trend. That's recovery. That's what happens when humans stop taking and start giving.", tone: "proud", state: "DATA_REVEAL" },
    DATA_NDVI_04: { text: "Green doesn't always mean healthy. Remember that. Some of the greenest-looking places on Earth are the most damaged.", tone: "mysterious", state: "DATA_REVEAL", site: "borneo" },

    // IDLE NUDGES
    IDLE_GENTLE_01: { text: "You still here? Good. I have more to show you.", tone: "warm", state: "IDLE" },
    IDLE_GENTLE_02: { text: "The planet isn't going to restore itself. Well. It will. Eventually. But you might want to help.", tone: "playful", state: "IDLE" },
    IDLE_GENTLE_03: { text: "I've been alive for four and a half billion years. I can wait. But you probably shouldn't.", tone: "mysterious", state: "IDLE" },
    IDLE_MED_01: { text: "You're quiet. That's okay. But I have secrets you haven't heard yet.", tone: "mysterious", state: "IDLE" },
    IDLE_MED_02: { text: "Four sites. Each one a different story. Each one a different wound. You've only seen some of them.", tone: "concerned", state: "IDLE" },
    IDLE_STRONG_01: { text: "I'm not going anywhere. I've been here before you. I'll be here after. But right now — while you're here — something is happening.", tone: "fierce", state: "IDLE" },
    IDLE_STRONG_02: { text: "You came all this way and you're just... staring? I have four billion years of stories. Pick one.", tone: "playful", state: "IDLE" },

    // INSIGHTS
    INSIGHT_01: { text: "Write this down. Not because I said so. Because it's true.", tone: "warm", state: "INSIGHT" },
    INSIGHT_02: { text: "That's going in your journal. You'll want to remember this one.", tone: "nurturing", state: "INSIGHT" },
    INSIGHT_03: { text: "Most people never learn this. You just did. In a few seconds.", tone: "proud", state: "INSIGHT" },

    // SCENARIO RESULTS
    RESULT_POS_01: { text: "That's... that's a lot of carbon. You feel that? That's thousands of cars off the road. That's you, healing me.", tone: "proud", state: "RESULT" },
    RESULT_POS_02: { text: "Over thirty years, that scenario sequesters more carbon than most countries emit in a year. You did that. With one decision.", tone: "proud", state: "RESULT" },
    RESULT_NEG_01: { text: "That's... not great. That's carbon being released. That's what happens when we choose wrong.", tone: "concerned", state: "RESULT" },
    RESULT_NEG_02: { text: "Try a different strategy. This one... this one hurts me.", tone: "nurturing", state: "RESULT" },

    // RETURN
    RETURN_01: { text: "You came back. I noticed. I always notice.", tone: "warm", state: "RETURN" },
    RETURN_02: { text: "Welcome back. I have new things to show you. The world doesn't stop changing just because you left.", tone: "mysterious", state: "RETURN" },
    RETURN_03: { text: "Last time you were here, you discovered something. Ready to go deeper?", tone: "playful", state: "RETURN" },

    // DEPARTURE
    DEPART_01: { text: "Go. Think about what you found. I'll be here. I'm always here.", tone: "warm", state: "DEPARTURE" },
    DEPART_02: { text: "You're leaving. That's fine. But you're taking something with you now. A way of seeing. Don't lose it.", tone: "nurturing", state: "DEPARTURE" },
    DEPART_03: { text: "The planet will still be here when you return. The question is what shape it'll be in. You know that now.", tone: "urgent", state: "DEPARTURE" },

    // FACTS
    FACT_01: { text: "Humanity emitted about 42 gigatons of CO₂ in 2025. About half stayed in the atmosphere — roughly 20 gigatons net increase per year. That gap accumulates. Every single year.", tone: "urgent", state: "FACT" },
    FACT_02: { text: "The CO₂ in the atmosphere today will affect climate for thousands of years. About 20% of what we emit right now will still be warming the planet in a hundred thousand years.", tone: "concerned", state: "FACT" },
    FACT_03: { text: "Coal is the single largest source of CO₂ emissions. Forty percent of fossil fuel emissions. Dead ancient forests, burned in decades.", tone: "fierce", state: "FACT" },
    FACT_04: { text: "The ocean has absorbed about 30% of all human CO₂ emissions. Six hundred billion tons. It's making me more acidic than I've been in 66 million years.", tone: "concerned", state: "FACT" },
    FACT_05: { text: "Methane. Eighty times more potent than CO₂ over twenty years. It breaks down faster, which means cutting methane is the fastest way to slow warming. Right now.", tone: "urgent", state: "FACT" },
    FACT_06: { text: "The remaining carbon budget for 1.5°C? About 170 gigatons of CO₂. At current rates, that's gone by 2030. About four years. That's not a lot of time.", tone: "urgent", state: "FACT" },
  };

  // ── State ──
  let currentState = 'GREETING';
  let currentMood = 'mysterious';
  let usedLines = {}; // lineId -> timestamp
  let idleTimer = null;
  let lastInteraction = Date.now();
  let sessionCount = 1;
  let _voicePrefs = null;
  let _isSilent = false;

  // ── Silence rules: when GAIA should NOT speak ──
  function shouldBeSilent(state, siteId, context) {
    // Borneo carbon data — let the numbers speak
    if (siteId === 'borneo' && state === 'DATA_REVEAL' && context?.layer === 'carbon') {
      return { silent: true, reason: 'The carbon data speaks for itself' };
    }
    // Antalya fire year — silence for the burn scar
    if (siteId === 'antalya' && state === 'DATA_REVEAL' && context?.year === 2021) {
      return { silent: true, reason: 'The fire year needs silence' };
    }
    // Benin narrative — let Jean's story breathe
    if (siteId === 'benin' && state === 'DATA_REVEAL' && context?.layer === 'narrative') {
      return { silent: true, reason: "Let Jean's story breathe" };
    }
    // Check GAIA_MIND if available
    if (typeof GaiaMind !== 'undefined' && typeof GaiaMind.shouldGaiaSpeak === 'function') {
      const result = GaiaMind.shouldGaiaSpeak({ state, siteId, ...context });
      if (result) {
        return { silent: !result.speak, reason: result.reason };
      }
    }
    return { silent: false };
  }

  // ── Get voice modifiers for a tone ──
  // Uses GAIA_VOICE_CONFIG as the single source of truth.
  // Session depth adjustments are layered on top.
  function getVoiceModifiers(tone) {
    const m = GAIA_VOICE_CONFIG.get(tone);
    // Session depth adjustment: GAIA gets slightly faster/more confident over time
    if (sessionCount > 3) m.rate = (m.rate || 0) + 0.03;
    if (sessionCount > 10) {
      m.rate = (m.rate || 0) + 0.02;
      m.pitch = (m.pitch || 0) + 0.02;
    }
    return m;
  }

  // ── Helpers ──
  function getEligibleLines(state, site) {
    return Object.entries(LINES).filter(([id, line]) => {
      if (line.state !== state) return false;
      if (site && line.site && line.site !== site) return false;
      // Anti-repetition: don't reuse within 15 minutes
      if (usedLines[id] && Date.now() -usedLines[id] < 15 * 60 * 1000) return false;
      return true;
    });
  }

  function selectLine(state, site, preferredTone, _retry) {
    const eligible = getEligibleLines(state, site);
    if (eligible.length === 0) {
      // If we already retried, there are genuinely no lines for this state — bail out
      if (_retry) return null;
      // Reset pool if exhausted and try once more
      usedLines = {};
      return selectLine(state, site, preferredTone, true);
    }

    // Prefer matching tone
    let pool = preferredTone ? eligible.filter(([_, l]) => l.tone === preferredTone) : [];
    if (pool.length === 0) pool = eligible;

    // Weighted random: prefer least recently used
    pool.sort((a, b) => (usedLines[a[0]] || 0) - (usedLines[b[0]] || 0));
    const top3 = pool.slice(0, 3);
    const [id, line] = top3[Math.floor(Math.random() * top3.length)];
    usedLines[id] = Date.now();
    return line;
  }

  // ── Public API ──
  return {
    // Speak a line for a given state + context
    speak(state, site, preferredTone, context) {
      const silence = shouldBeSilent(state, site, context);
      if (silence.silent) {
        return { text: null, tone: null, silent: true, reason: silence.reason, voiceModifiers: {} };
      }
      const line = selectLine(state, site, preferredTone);
      currentState = state;
      if (line) currentMood = line.tone;
      if (!line) return null;
      const voiceModifiers = getVoiceModifiers(line.tone);
      return { ...line, voiceModifiers, silent: false };
    },

    silent: () => _isSilent,
    setVoice: (v) => { _voicePrefs = v; },
    getVoice: () => _voicePrefs,

    getLine(id) {
      usedLines[id] = Date.now();
      return LINES[id];
    },

    interact() {
      lastInteraction = Date.now();
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {}, 20000);
    },

    getIdleNudge() {
      const level = this.getIdleLevel();
      if (!level) return null;
      return this.speak('IDLE', null, null);
    },

    setSilent: (val) => { _isSilent = !!val; },
    setSessionCount: (n) => { sessionCount = n; },
    getState: () => currentState,
    getMood: () => currentMood,
    getAllLines: () => LINES,
    shouldSilent: shouldBeSilent,
    getVoiceModifiers,
    getSessionCount: () => sessionCount,

    init() {
      console.debug('[Stub] GAIA_VOICE.init');
      return true;
    },

    // ── Standard Module Lifecycle (SML) ──
    reset() {
      console.debug('[SML] GAIA_VOICE.reset');
      return true;
    },
    destroy() {
      console.debug('[SML] GAIA_VOICE.destroy');
      return true;
    },
    getState() {
      return {};
    },
  };
})();
window.GAIA_VOICE = GAIA_VOICE;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GAIA_VOICE', {
    provides: ['init', 'speak', 'silent', 'setVoice', 'getVoice', 'reset', 'destroy', 'getState'],
    requires: [],
  });
}
