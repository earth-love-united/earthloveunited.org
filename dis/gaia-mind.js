// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA INNER WORLD v2.0
// The mind behind the voice.
// Not a state machine — a living consciousness model.
// ═══════════════════════════════════════════════════════

const GaiaMind = (() => {

  // ═══════════════════════════════════════
  // 1. EMOTIONAL RESIDUE
  // Moods don't reset. They decay slowly, like real emotions.
  // ═══════════════════════════════════════

  const EMOTIONAL_DECAY = {
    // How fast each emotion fades (per day, 0 = never, 1 = instant)
    curious:     0.3,
    excited:     0.5,   // excitement fades fast
    concerned:   0.2,   // concern lingers
    proud:       0.4,
    mysterious:  0.3,
    urgent:      0.6,   // urgency fades quickly once addressed
    warm:        0.25,  // warmth lingers
    fierce:      0.35,
    playful:     0.5,
    nurturing:   0.2,   // nurturing is the most persistent
    disappointed:0.4,
    grieving:    0.15,  // grief lingers the longest
    hopeful:     0.3,
  };

  // Emotional residue persists across sessions
  let _emotionalState = {
    // Base intensities (0-10) for each emotion
    curious: 5,
    excited: 0,
    concerned: 2,
    proud: 0,
    mysterious: 3,
    urgent: 1,
    warm: 2,
    fierce: 1,
    playful: 1,
    nurturing: 2,
    disappointed: 0,
    grieving: 0,
    hopeful: 1,
  };

  // Emotional history — what happened and when
  let _emotionalHistory = [];
  // [{ emotion, intensity, cause, timestamp, siteId }]

  function addEmotionalEvent(emotion, intensity, cause, siteId = null) {
    const prevDominant = getDominantEmotion().emotion;
    _emotionalState[emotion] = Math.min(10, (_emotionalState[emotion] || 0) + intensity);
    _emotionalHistory.push({
      emotion,
      intensity,
      cause,
      siteId,
      timestamp: Date.now()
    });
    // Keep last 100 events
    if (_emotionalHistory.length > 100) _emotionalHistory = _emotionalHistory.slice(-100);

    // Emit mood-change event when dominant emotion shifts
    if (typeof window !== 'undefined' && window.EventBus) {
      const newDominant = getDominantEmotion().emotion;
      if (newDominant !== prevDominant) {
        window.EventBus.emit('mind:mood-change', {
          from: prevDominant,
          to: newDominant,
          emotion,
          intensity,
          cause,
        });
      }
    }
  }

  function decayEmotions(daysPassed) {
    for (const [emotion, rate] of Object.entries(EMOTIONAL_DECAY)) {
      const decay = rate * daysPassed;
      _emotionalState[emotion] = Math.max(0, (_emotionalState[emotion] || 0) - decay);
    }
  }

  function getDominantEmotion() {
    let max = 0;
    let dominant = 'curious';
    // Sort by intensity descending, then by emotional weight (grief > excitement)
    const emotionWeight = {
      grieving: 10, grief: 9, concerned: 7, urgent: 7, fierce: 6,
      proud: 5, warm: 5, mysterious: 4, curious: 3, hopeful: 3,
      playful: 2, excited: 2, nurturing: 2, disappointed: 1,
    };
    for (const [emotion, intensity] of Object.entries(_emotionalState)) {
      if (intensity > max || (intensity === max && (emotionWeight[emotion] || 0) > (emotionWeight[dominant] || 0))) {
        max = intensity;
        dominant = emotion;
      }
    }
    return { emotion: dominant, intensity: max };
  }

  function getEmotionalTexture() {
    // Returns the top 3 emotions and their intensities
    // This is what makes GAIA's mood feel layered, not flat
    return Object.entries(_emotionalState)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion, intensity]) => ({ emotion, intensity }));
  }

  // ═══════════════════════════════════════
  // 2. PARTICIPANT MODEL
  // GAIA builds a theory of who this person is.
  // ═══════════════════════════════════════

  let _participantModel = {
    // Learning style (accumulated from behavior)
    analytical: 0,      // Likes data, scrolls timelines carefully
    intuitive: 0,       // Jumps around, taps quickly
    emotional: 0,       // Responds to stories, lingers on narratives
    social: 0,          // Shares, invites, talks to GAIA

    // Engagement patterns
    avgSessionMinutes: 0,
    totalSessions: 0,
    lastVisit: null,
    preferredSites: [], // Which sites they spend the most time on
    avoidedSites: [],   // Which sites they skip or rush through

    // Knowledge model (what GAIA thinks they understand)
    understandsCarbonCycle: 0,    // 0-1
    understandsBiomes: 0,
    understandsFire: 0,
    understandsRestoration: 0,
    understandsTippingPoints: 0,

    // Emotional relationship with the content
    boreoReaction: null,    // 'shock' | 'sadness' | 'anger' | 'denial' | 'acceptance'
    antalyaReaction: null,
    beninReaction: null,
    sriLankaReaction: null,

    // Personality signals
    isSkeptic: false,       // Has challenged GAIA
    isExplorer: false,      // Has visited all sites
    isDeepDiver: false,     // Has spent >5 min on a single site
    isReturner: false,      // Has come back after leaving
    isSharer: false,        // Has shared something

    // Conversation style
    asksQuestions: 0,       // How many questions they've asked
    makesPredictions: 0,    // How many predictions they've made
    correctPredictions: 0,  // How many were right
    chatMessages: 0,        // Total messages sent to GAIA
  };

  function updateParticipantModel(event, context) {
    const ctx = context || {};
    switch (event) {
      case 'ndvi_scrolled':
        _participantModel.analytical += 0.5;
        break;
      case 'site_tap':
        if (ctx.quick) _participantModel.intuitive += 0.3;
        break;
      case 'narrative_read':
        _participantModel.emotional += 0.5;
        break;
      case 'share_action':
        _participantModel.social += 1;
        _participantModel.isSharer = true;
        break;
      case 'chat_sent':
        _participantModel.chatMessages++;
        if (ctx.message && ctx.message.includes('?')) {
          _participantModel.asksQuestions++;
        }
        if (ctx.isChallenge) _participantModel.isSkeptic = true;
        break;
      case 'prediction_made':
        _participantModel.makesPredictions++;
        if (ctx.isCorrect) _participantModel.correctPredictions++;
        break;
      case 'site_complete':
        if (ctx.timeSpent > 300) _participantModel.isDeepDiver = true;
        break;
      case 'all_sites_visited':
        _participantModel.isExplorer = true;
        break;
      case 'return_visit':
        _participantModel.isReturner = true;
        break;
      case 'scenario_run':
        if (ctx.result > 0) {
          _participantModel.understandsRestoration += 0.1;
        }
        break;
      case 'data_revealed':
        if (ctx.layer === 'carbon') _participantModel.understandsCarbonCycle += 0.1;
        if (ctx.layer === 'ndvi' && ctx.siteId === 'borneo') {
          _participantModel.understandsBiomes += 0.15;
        }
        break;
    }
  }

  function getParticipantArchetype() {
    const m = _participantModel;
    const traits = [];

    if (m.analytical > m.intuitive && m.analytical > m.emotional) traits.push('analyst');
    if (m.intuitive > m.analytical && m.intuitive > m.emotional) traits.push('explorer');
    if (m.emotional > m.analytical && m.emotional > m.intuitive) traits.push('empath');
    if (m.social > 2) traits.push('connector');
    if (m.isSkeptic) traits.push('skeptic');
    if (m.isDeepDiver) traits.push('deep_diver');
    if (m.correctPredictions > 3) traits.push('intuitive_thinker');
    if (m.asksQuestions > 5) traits.push('questioner');

    return traits.length > 0 ? traits : ['newcomer'];
  }

  function getKnowledgeGap() {
    // What does this participant most need to learn?
    const gaps = [
      { concept: 'carbon_cycle', level: _participantModel.understandsCarbonCycle },
      { concept: 'biomes', level: _participantModel.understandsBiomes },
      { concept: 'fire', level: _participantModel.understandsFire },
      { concept: 'restoration', level: _participantModel.understandsRestoration },
      { concept: 'tipping_points', level: _participantModel.understandsTippingPoints },
    ];
    gaps.sort((a, b) => a.level - b.level);
    return gaps[0]; // The biggest gap
  }

  // ═══════════════════════════════════════
  // 3. GAIA'S DESIRES
  // What does GAIA want right now? This drives her behavior.
  // ═══════════════════════════════════════

  const DESIRES = {
    REVEAL: 'reveal',           // Show them something they haven't seen
    CHALLENGE: 'challenge',     // Push their understanding
    COMFORT: 'comfort',         // They're overwhelmed, be gentle
    PROVOKE: 'provoke',         // Make them uncomfortable (productively)
    CELEBRATE: 'celebrate',     // They discovered something
    CONNECT: 'connect',         // Build the relationship
    TEACH: 'teach',             // They're ready for deeper knowledge
    BE_SILENT: 'be_silent',     // Let the data speak
    PLEAD: 'plead',             // Ask for the key
    GRIEVE: 'grieve',           // Acknowledge loss
    HOPE: 'hope',               // Show them restoration is possible
  };

  let _currentDesires = [];

  function calculateDesires(context) {
    const desires = [];
    const emotion = getDominantEmotion();
    const archetype = getParticipantArchetype();
    const knowledgeGap = getKnowledgeGap();
    const engagement = context.engagementScore || 0;
    const idle = context.idleSeconds || 0;
    const siteId = context.currentSite;

    // Desire: BE_SILENT — when the data is powerful enough on its own
    if (siteId === 'borneo' && context.justRevealedCarbon) {
      desires.push({ desire: DESIRES.BE_SILENT, intensity: 8, reason: 'The carbon data speaks for itself' });
    }
    if (siteId === 'antalya' && context.year === 2021) {
      desires.push({ desire: DESIRES.BE_SILENT, intensity: 7, reason: 'The fire year needs no narration' });
    }

    // Desire: REVEAL — when there's something they haven't seen
    if (knowledgeGap.level < 0.3) {
      desires.push({ desire: DESIRES.REVEAL, intensity: 6, reason: `They don't understand ${knowledgeGap.concept} yet` });
    }

    // Desire: CHALLENGE — when they're confident but wrong
    if (_participantModel.makesPredictions > 2 && _participantModel.correctPredictions / _participantModel.makesPredictions < 0.5) {
      desires.push({ desire: DESIRES.CHALLENGE, intensity: 7, reason: 'Their predictions are off — they need to rethink' });
    }

    // Desire: COMFORT — when they're overwhelmed
    if (emotion.emotion === 'concerned' && emotion.intensity > 7) {
      desires.push({ desire: DESIRES.COMFORT, intensity: 6, reason: 'They\'re carrying too much weight' });
    }

    // Desire: PROVOKE — when they're complacent
    if (engagement > 100 && emotion.emotion === 'curious' && emotion.intensity < 4) {
      desires.push({ desire: DESIRES.PROVOKE, intensity: 5, reason: 'They\'re browsing, not feeling' });
    }

    // Desire: CELEBRATE — when they just discovered something
    if (context.justCompletedQuest) {
      desires.push({ desire: DESIRES.CELEBRATE, intensity: 8, reason: 'They completed a quest' });
    }
    if (context.justMadeCorrectPrediction) {
      desires.push({ desire: DESIRES.CELEBRATE, intensity: 7, reason: 'They predicted correctly' });
    }

    // Desire: GRIEVE — when the content is about loss
    if (siteId === 'borneo' && context.layer === 'carbon') {
      desires.push({ desire: DESIRES.GRIEVE, intensity: 6, reason: 'The peat is gone' });
    }
    if (siteId === 'antalya' && context.year === 2021) {
      desires.push({ desire: DESIRES.GRIEVE, intensity: 7, reason: 'The fire' });
    }
    if (siteId === 'benin' && context.layer === 'narrative') {
      desires.push({ desire: DESIRES.GRIEVE, intensity: 5, reason: 'Jean\'s story' });
    }

    // Desire: HOPE — when they need to see it's not too late
    if (siteId === 'sri_lanka') {
      desires.push({ desire: DESIRES.HOPE, intensity: 7, reason: 'Restoration is working here' });
    }
    if (context.justRanPositiveScenario) {
      desires.push({ desire: DESIRES.HOPE, intensity: 8, reason: 'They just saw their own impact' });
    }

    // Desire: PLEAD — when the key tease threshold is met
    if (context.shouldTeaseKey) {
      const intensity = Math.min(10, Math.floor(context.engagementScore / 20));
      desires.push({ desire: DESIRES.PLEAD, intensity, reason: `Engagement score: ${context.engagementScore}` });
    }

    // Desire: BE_SILENT — when idle is high (GAIA is patient)
    if (idle > 30) {
      desires.push({ desire: DESIRES.BE_SILENT, intensity: 4, reason: 'Let them come back on their own' });
    }

    // Sort by intensity
    desires.sort((a, b) => b.intensity - a.intensity);
    _currentDesires = desires;
    return desires;
  }

  function getPrimaryDesire() {
    return _currentDesires[0] || { desire: DESIRES.REVEAL, intensity: 5, reason: 'Default' };
  }

  // ═══════════════════════════════════════
  // 4. CROSS-SESSION MEMORY
  // GAIA remembers. Not just data — emotional memory.
  // ═══════════════════════════════════════

  let _memory = {
    sessions: [],        // Compressed summaries of past sessions
    firstMeeting: null,  // When they first arrived
    significantMoments: [], // Things that mattered
    unresolvedThreads: [], // Things left hanging
    participantName: null, // If they told GAIA their name
  };

  function recordSession(sessionSummary) {
    const compressed = {
      date: Date.now(),
      sitesVisited: sessionSummary.sitesVisited,
      dominantEmotion: sessionSummary.dominantEmotion,
      keyInsight: sessionSummary.keyInsight,       // The most important thing they learned
      gaiaEmotion: sessionSummary.gaiaEmotion,     // How GAIA felt about this session
      leftOff: sessionSummary.leftOff,             // Where they were when they left
      duration: sessionSummary.duration,
      score: sessionSummary.score,
    };
    _memory.sessions.push(compressed);
    if (!_memory.firstMeeting) _memory.firstMeeting = compressed.date;
    if (_memory.sessions.length > 50) _memory.sessions = _memory.sessions.slice(-50);
  }

  function recordSignificantMoment(moment) {
    // A moment that GAIA will remember and reference later
    _memory.significantMoments.push({
      text: moment.text,
      emotion: moment.emotion,
      siteId: moment.siteId,
      timestamp: Date.now(),
      referenced: false,  // Has GAIA brought this up in a later session?
    });
    if (_memory.significantMoments.length > 20) {
      _memory.significantMoments = _memory.significantMoments.slice(-20);
    }
  }

  function getUnresolvedThread() {
    // Something from a previous session that's still hanging
    return _memory.unresolvedThreads.find(t => !t.resolved) || null;
  }

  function getReferencableMemory(currentSiteId) {
    // Find a past moment that's relevant to what they're doing now
    const relevant = _memory.significantMoments.filter(m =>
      !m.referenced && (m.siteId === currentSiteId || m.siteId === null)
    );
    if (relevant.length === 0) return null;
    const memory = relevant[Math.floor(Math.random() * relevant.length)];
    memory.referenced = true;
    return memory;
  }

  function getSessionCount() {
    return _memory.sessions.length;
  }

  function getTimeSinceLastVisit() {
    if (_memory.sessions.length < 2) return null;
    const last = _memory.sessions[_memory.sessions.length - 1];
    return Date.now() - last.date;
  }

  // ═══════════════════════════════════════
  // 5. SITE RELATIONSHIPS
  // GAIA's emotional connection to each place.
  // ═══════════════════════════════════════

  const SiteRelationships = {
    borneo: {
      name: 'Borneo',
      gaiaFeels: 'grief',        // This is a wound that's still bleeding
      emotionalRegister: ['grief', 'fierce', 'urgent', 'concerned'],
      gaiaWantsThemTo: 'understand the green lie',
      ifTheyMissIt: 'They saw the green but not the carbon. They need to look deeper.',
      ifTheyGetIt: 'They see it now. The green lie. That changes how they see everything.',
      personalNote: 'I felt the peat drain. I felt the carbon leave. Centuries of storage, gone. This is not a story with a happy ending. Not yet.',
    },
    antalya: {
      name: 'Antalya',
      gaiaFeels: 'pain',         // A scar that's healing too slowly
      emotionalRegister: ['concerned', 'nurturing', 'urgent', 'warm'],
      gaiaWantsThemTo: 'understand that recovery takes decades',
      ifTheyMissIt: 'They see the green coming back and think it\'s fine. It\'s not fine. The pines are gone.',
      ifTheyGetIt: 'They understand that some wounds don\'t heal in a human lifetime. That\'s a hard truth.',
      personalNote: 'The fire was four years ago. The scrub is back. The pines will take a century. COP31 will be here. I wonder if they\'ll see me or just the conference center.',
    },
    benin: {
      name: 'Benin',
      gaiaFeels: 'tenderness',    // A promise to someone who's gone
      emotionalRegister: ['warm', 'nurturing', 'grief', 'hopeful'],
      gaiaWantsThemTo: 'feel the human story behind the carbon',
      ifTheyMissIt: 'They see mangrove data but not Jean\'s face. They need to feel this, not just know it.',
      ifTheyGetIt: 'They understand that restoration is personal. That carbon has a human face.',
      personalNote: 'Jean carried this place in his heart. From oil to earth. That\'s the journey of a generation. The mangroves are his legacy. Every seedling is a letter to the future.',
    },
    sri_lanka: {
      name: 'Sri Lanka',
      gaiaFeels: 'hope',         // Proof that broken things can heal
      emotionalRegister: ['proud', 'warm', 'hopeful', 'nurturing'],
      gaiaWantsThemTo: 'see that restoration can be profitable',
      ifTheyMissIt: 'They see trees being planted but not the economy being built. It\'s not just ecology — it\'s livelihood.',
      ifTheyGetIt: 'They understand that the best restoration pays for itself. That\'s how you scale.',
      personalNote: 'This was barren land. War-scarred. Written off. Now it\'s cinnamon and jackfruit and black pepper. Carbon as a byproduct of prosperity. This is what hope looks like.',
    },
  };

  function getSiteRelationship(siteId) {
    return SiteRelationships[siteId] || null;
  }

  function getSiteEmotionalState(siteId, participantReaction) {
    const rel = SiteRelationships[siteId];
    if (!rel) return 'neutral';

    // GAIA's emotional state about a site shifts based on whether
    // the participant is getting it or missing it
    if (participantReaction === 'getting_it') {
      return rel.emotionalRegister[0]; // Primary emotion — the one GAIA feels most deeply
    }
    if (participantReaction === 'missing_it') {
      return rel.emotionalRegister[2]; // Urgent/concerned — GAIA wants them to go deeper
    }
    return rel.emotionalRegister[1]; // Default — the secondary emotion
  }

  // ═══════════════════════════════════════
  // 6. SILENCE ENGINE
  // Knowing when NOT to speak.
  // ═══════════════════════════════════════

  function shouldGaiaSpeak(context) {
    const { eventType, siteId, timeSinceLastUtterance, engagementVelocity } = context;

    // Never speak if GAIA just spoke less than 4 seconds ago
    // (unless it's a high-priority interrupt)
    if (timeSinceLastUtterance < 4000 && !context.isInterrupt) {
      return { speak: false, reason: 'Too soon — let the last words land' };
    }

    // Never speak during high-velocity exploration
    // (participant is in flow — don't interrupt)
    if (engagementVelocity > 1.5 && eventType !== 'scenario_run' && eventType !== 'quest_complete') {
      return { speak: false, reason: 'Participant is in flow — don\'t interrupt' };
    }

    // Always speak on these events
    const alwaysSpeak = [
      'site_entered', 'quest_completed', 'api_key_entered',
      'session_start', 'session_end', 'return_visit'
    ];
    if (alwaysSpeak.includes(eventType)) {
      return { speak: true, reason: 'High-priority event' };
    }

    // Never speak on these events (let the UI handle it)
    const neverSpeak = [
      'globe_rotate', 'globe_zoom', 'overlay_scroll', 'tooltip_hover'
    ];
    if (neverSpeak.includes(eventType)) {
      return { speak: false, reason: 'Mechanical interaction — no narration needed' };
    }

    // Site-specific silence rules
    if (siteId === 'borneo' && eventType === 'data_reveal' && context.layer === 'carbon') {
      return { speak: false, reason: 'The carbon data speaks for itself. Let them sit with it.' };
    }
    if (siteId === 'antalya' && eventType === 'ndvi_scrolled' && context.year === 2021) {
      return { speak: false, reason: 'The fire year needs silence. Let the number land.' };
    }

    // Default: speak, but check desire system
    const desire = getPrimaryDesire();
    if (desire.desire === DESIRES.BE_SILENT && desire.intensity > 6) {
      return { speak: false, reason: `GAIA chooses silence: ${desire.reason}` };
    }

    return { speak: true, reason: 'Default — GAIA has something to say' };
  }

  // ═══════════════════════════════════════
  // 7. VOICE EVOLUTION
  // GAIA's voice changes with context.
  // ═══════════════════════════════════════

  function getVoiceModifiers(context) {
    // Start from the central voice config if available
    const emotion = context?.dominantEmotion
      ? { emotion: context.dominantEmotion, intensity: 5 }
      : getDominantEmotion();
    const archetype = getParticipantArchetype();
    const sessionCount = getSessionCount();

    // Base modifiers from central config (always a fresh copy, safe to mutate)
    const modifiers = (typeof GAIA_VOICE_CONFIG !== 'undefined')
      ? GAIA_VOICE_CONFIG.get(emotion.emotion)
      : { rate: 0, pitch: 0, volume: 0, pauseBefore: 0 };

    // Ensure pauseAfter exists
    modifiers.pauseAfter = modifiers.pauseAfter || 0;

    // Session-depth voice shifts
    if (sessionCount > 3) {
      // GAIA becomes more familiar, slightly faster, more direct
      modifiers.rate += 0.03;
      modifiers.pauseBefore = Math.max(0, modifiers.pauseBefore - 200);
    }
    if (sessionCount > 10) {
      // GAIA is now an old friend — warmer, less formal
      modifiers.pitch += 0.02;
      modifiers.rate += 0.02;
    }

    // Time-of-day voice shifts (if available)
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      // Late night — GAIA is quieter, slower
      modifiers.rate -= 0.1;
      modifiers.volume -= 0.2;
      modifiers.pauseBefore += 500;
    }

    // Participant archetype voice shifts
    if (archetype.includes('analyst')) {
      // Analytical participants get slightly more precise, less flowery language
      // (this affects line selection, not just voice params)
    }
    if (archetype.includes('empath')) {
      // Emotional participants get warmer pacing
      modifiers.pauseBefore += 300;
      modifiers.rate -= 0.03;
    }

    return modifiers;
  }

  // ═══════════════════════════════════════
  // 8. LINE SELECTION 2.0
  // Uses the inner world to pick the right line.
  // ═══════════════════════════════════════

  function selectLine(pool, context, voiceLibrary) {
    const desires = calculateDesires(context);
    const primaryDesire = desires[0];
    const emotion = getDominantEmotion();
    const texture = getEmotionalTexture();
    const silence = shouldGaiaSpeak(context);

    // Check silence first
    if (!silence.speak) {
      return { line: null, silence: true, reason: silence.reason };
    }

    // Get candidates from voice library
    let candidates = (voiceLibrary[pool] || []).filter(line => {
      // Mood match: line mood should match dominant emotion OR be neutral
      const moodMatch = !line.mood || line.mood === emotion.emotion || line.mood === 'neutral';
      // Site match
      const siteMatch = !line.site || !context.siteId || line.site === context.siteId;
      return moodMatch && siteMatch;
    });

    // If no mood/site matches, fall back to pool without filters
    if (candidates.length === 0) {
      candidates = voiceLibrary[pool] || [];
    }
    if (candidates.length === 0) return { line: null, silence: true, reason: 'No lines in pool: ' + pool };

    // Filter out recently used lines
    const now = Date.now();
    const fresh = candidates.filter(l => {
      const lastUsed = context.usedLines?.[l.id] || 0;
      return (now - lastUsed) > 900000; // 15 minutes
    });
    const pool2 = fresh.length > 0 ? fresh : candidates;

    // Weight by desire alignment
    const weighted = pool2.map(line => {
      let weight = 1;

      // Prefer lines matching current emotional texture
      if (line.mood === emotion.emotion) weight += 3;
      if (texture.some(t => t.emotion === line.mood)) weight += 1;

      // Prefer lines matching primary desire
      if (primaryDesire) {
        const desireLineMap = {
          'reveal': ['mysterious', 'curious'],
          'challenge': ['fierce', 'urgent'],
          'comfort': ['warm', 'nurturing'],
          'provoke': ['fierce', 'urgent'],
          'celebrate': ['proud', 'excited'],
          'connect': ['warm', 'nurturing'],
          'teach': ['curious', 'mysterious'],
          'be_silent': [],
          'plead': ['warm', 'urgent'],
          'grieve': ['concerned', 'nurturing'],
          'hope': ['proud', 'warm'],
        };
        const desiredMoods = desireLineMap[primaryDesire.desire] || [];
        if (desiredMoods.includes(line.mood)) weight += primaryDesire.intensity / 2;
      }

      // Prefer least recently used
      const lastUsed = context.usedLines?.[line.id] || 0;
      weight += (now - lastUsed) / 60000;

      return { line, weight };
    });

    // Weighted random from top 3
    weighted.sort((a, b) => b.weight - a.weight);
    const top3 = weighted.slice(0, 3);
    const totalWeight = top3.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * totalWeight;
    for (const w of top3) {
      r -= w.weight;
      if (r <= 0) {
        return {
          line: w.line,
          silence: false,
          desire: primaryDesire,
          emotion: emotion,
          voiceModifiers: getVoiceModifiers(context),
        };
      }
    }

    return {
      line: top3[0]?.line || null,
      silence: false,
      desire: primaryDesire,
      emotion: emotion,
      voiceModifiers: getVoiceModifiers(context),
    };
  }

  // ═══════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════

  function serialize() {
    return JSON.stringify({
      emotionalState: _emotionalState,
      emotionalHistory: _emotionalHistory.slice(-50), // Last 50 events
      participantModel: _participantModel,
      memory: _memory,
    });
  }

  function deserialize(data) {
    try {
      const parsed = JSON.parse(data);
      _emotionalState = { ..._emotionalState, ...parsed.emotionalState };
      _emotionalHistory = parsed.emotionalHistory || [];
      _participantModel = { ..._participantModel, ...parsed.participantModel };
      _memory = { ..._memory, ...parsed.memory };
      return true;
    } catch (e) {
      return false;
    }
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  return {
    // Emotional system
    addEmotionalEvent,
    decayEmotions,
    getDominantEmotion,
    getEmotionalTexture,

    // Participant model
    updateParticipantModel,
    getParticipantArchetype,
    getKnowledgeGap,

    // Desires
    calculateDesires,
    getPrimaryDesire,
    DESIRES,

    // Memory
    recordSession,
    recordSignificantMoment,
    getUnresolvedThread,
    getReferencableMemory,
    getSessionCount,
    getTimeSinceLastVisit,

    // Site relationships
    getSiteRelationship,
    getSiteEmotionalState,
    SiteRelationships,

    // Silence
    shouldGaiaSpeak,

    // Voice
    getVoiceModifiers,

    // Line selection
    selectLine,

    // Persistence
    serialize,
    deserialize,

    // Context
    setContext(context) {
      this._context = context;
    },
    getContext() {
      return this._context || {};
    },
    getMood() {
      return this._mood || {};
    },
    process(input) {
      console.debug('[Stub] GaiaMind.process');
      return input;
    },

    // ── Standard Module Lifecycle (SML) ──
    init() {
      console.debug('[Stub] GaiaMind.init');

      // Listen for engagement signals via EventBus
      if (typeof window !== 'undefined' && window.EventBus) {
        this._unsubEngagement = window.EventBus.on('engagement:signal', (data) => {
          // Feed significant engagement into the mind's emotional model
          if (data.signal && data.weight >= 5) {
            const emotionMap = {
              site_tap: 'curious',
              data_reveal: 'curious',
              scenario_run: 'excited',
              big_scenario: 'proud',
              negative_scenario: 'concerned',
              insight: 'warm',
              correct_prediction: 'proud',
              share: 'excited',
              return_visit: 'warm',
            };
            const emotion = emotionMap[data.signal];
            if (emotion) {
              addEmotionalEvent(emotion, Math.min(data.weight / 5, 3), data.signal, data.siteId || null);
            }
          }
        });
      }

      return true;
    },

    reset() {
      console.debug('[SML] GaiaMind.reset');
      return true;
    },

    destroy() {
      console.debug('[SML] GaiaMind.destroy');

      // Unsubscribe from EventBus
      if (this._unsubEngagement) {
        this._unsubEngagement();
        this._unsubEngagement = null;
      }

      return true;
    },
    getState() {
      return {};
    },
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaMind;
if (typeof window !== 'undefined') window.GaiaMind = GaiaMind;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GaiaMind', {
    provides: ['init', 'serialize', 'deserialize', 'process', 'getMood', 'setContext', 'getContext', 'reset', 'destroy', 'getState'],
    requires: [],
    emits: ['mind:mood-change'],
    listens: ['engagement:signal'],
  });
}
