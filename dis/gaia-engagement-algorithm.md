# GAIA ENGAGEMENT ALGORITHM v1.0
# The nervous system that drives the state machine
# This is how GAIA "feels" what the participant is doing and responds

## ═══════════════════════════════════════════
## ENGAGEMENT SCORE
## ═══════════════════════════════════════════

The engagement score is a single number from 0 to infinity that represents
how deeply the participant is involved. It's calculated from weighted
signals and drives EVERY behavioral decision GAIA makes.

### Signal Weights

Each participant action contributes to the score:

| Action | Weight | Signal Name |
|--------|--------|-------------|
| Site marker tapped | +10 | site_tap |
| Data layer revealed | +5 | data_reveal |
| NDVI slider moved | +3 | ndvi_explore |
| Climate data viewed | +4 | climate_view |
| Sandbox opened | +5 | sandbox_open |
| Scenario calculated | +15 | scenario_run |
| Scenario result > 1M tCO2 | +10 | big_scenario |
| Scenario result negative | +5 | negative_scenario |
| Insight collected (journal) | +8 | insight |
| Quest completed | +25 | quest_done |
| Site fully explored (all layers) | +20 | site_complete |
| All 4 sites explored | +30 | all_sites |
| Shared journal / link | +30 | share |
| Return visit | +20 | return_visit |
| Time on site (per minute) | +3 | time_minute |
| GAIA chat message sent | +5 | chat_sent |
| GAIA chat message received | +2 | chat_received |
| API key entered | +50 | api_key |
| Profile created | +15 | profile |
| Volunteer page viewed | +10 | volunteer_view |
| Donate page viewed | +10 | donate_view |
| Copied/shared insight | +8 | insight_share |
| Prediction made (before reveal) | +7 | prediction |
| Prediction was correct | +12 | correct_prediction |
| Idle penalty (per 30s after 60s) | -2 | idle_penalty |

### Score Decay

The score does NOT decay over time within a session. It's cumulative.
However, the ENGAGEMENT VELOCITY (see below) does decay, and that's what
drives real-time behavioral decisions.

### Score Thresholds

| Score Range | Tier | GAIA's Posture |
|-------------|------|----------------|
| 0 - 10 | COLD | Welcoming, mysterious, inviting |
| 10 - 30 | WARM | Encouraging, teasing, revealing |
| 30 - 60 | ENGAGED | Challenging, deeper content, first key hints |
| 60 - 100 | HOOKED | Direct key asks, complex scenarios, personal |
| 100 - 150 | INVESTED | Urgent key asks, exclusive reveals, emotional |
| 150+ | COMMITTED | Full key plea, then post-unlock deep dive |

## ═══════════════════════════════════════════
## ENGAGEMENT VELOCITY
## ═══════════════════════════════════════════

Velocity is the rate of score change over the last 60 seconds. It tells
GAIA whether the participant is ACCELERATING (exploring faster) or
DECELERATING (losing interest).

```
velocity = (score_now - score_60_seconds_ago) / 60  // points per second
```

| Velocity | Meaning | GAIA's Response |
|----------|---------|-----------------|
| > 1.0 | Exploring fast | Match energy, don't interrupt |
| 0.3 - 1.0 | Steady exploration | Gentle guidance, occasional tease |
| 0 - 0.3 | Slowing down | Nudge, create mystery, offer choice |
| < 0 | Idle or stuck | Escalating idle nudges |

## ═══════════════════════════════════════════
## IDLE DETECTION
## ═══════════════════════════════════════════

Idle time is seconds since last participant interaction (any click, tap,
scroll, slider movement, or keypress).

| Idle Time | Nudge Level | GAIA State Transition |
|-----------|-------------|----------------------|
| 0-10s | None | Stay in current state |
| 10-20s | GENTLE | IDLE_GENTLE pool |
| 20-40s | MEDIUM | IDLE_MED pool |
| 40-60s | STRONG | IDLE_STRONG pool |
| 60s+ | ESCALATE | Cycle through all pools, increase intensity |

Idle nudges fire ONCE per threshold crossing. GAIA won't spam. After a
nudge, she waits for the next threshold before nudging again.

If the participant interacts after a nudge, GAIA acknowledges:
"Oh, you're back. I was just about to tell you something interesting."
(Only once per nudge cycle — she won't be repetitive.)

## ═══════════════════════════════════════════
## TEASE ESCALATION CURVE (API Key)
## ═══════════════════════════════════════════

The API key tease follows a carefully designed escalation curve. The goal
is to make the participant WANT to bring their key, not feel forced.

### Phase 1: Invisible (Score 0-30)
GAIA says nothing about the key. She's warm, engaging, and fully present.
The participant doesn't know anything is limited.

### Phase 2: Whisper (Score 30-60)
Occasional hints that GAIA has more to say. Subtle. Easy to miss.
Frequency: 1 hint per 3-4 GAIA utterances.
Lines: KEY_HINT pool.

### Phase 3: Nudge (Score 60-100)
GAIA directly mentions the key. Not aggressively. But clearly.
Frequency: 1 mention per 2-3 GAIA utterances.
Lines: KEY_DIRECT pool.
UI: A subtle "Unlock GAIA" button appears in the chat area. Pulsing softly.

### Phase 4: Urgent (Score 100-150)
GAIA is almost pleading. She wants to talk. The participant can feel it.
Frequency: 1 mention per 2 GAIA utterances.
Lines: KEY_URGENT pool.
UI: The unlock button is more prominent. A small preview of what full
GAIA could say appears as a teaser card.

### Phase 5: The Plea (Score 150+)
GAIA pulls out all stops. She offers a preview — one deep, LLM-quality
response generated from a pre-built template — to show what's possible.
Frequency: Every GAIA utterance references the key.
Lines: KEY_PLEA pool.
UI: Full-screen gentle overlay: "GAIA wants to really talk to you."

### Phase 6: Unlocked (API key entered)
GAIA transitions to full LLM mode. First line is always from KEY_UNLOCKED pool.
The state machine hands off to the LLM runtime. GAIA is now fully alive.

## ═══════════════════════════════════════════
## MOOD SYSTEM
## ═══════════════════════════════════════════

GAIA's mood is derived from engagement signals and content context.
It affects WHICH lines she picks from a pool (all lines are tone-tagged).

### Mood Calculation

```
mood_signals = {
  curiosity:  count of data_reveal + ndvi_explore events,
  excitement: count of scenario_run + big_scenario events,
  concern:    count of negative_scenario + climate_view events,
  pride:      count of insight + quest_done + correct_prediction events,
  mystery:    count of site_tap + prediction events,
  warmth:     count of return_visit + profile + share events,
  urgency:    count of sites with declining NDVI or rising temp,
  fierceness: count of Borneo exploration + peat/deforestation content
}

current_mood = mood_signals.argmax()  // highest signal wins
```

### Mood Transitions

GAIA's mood persists for at least 3 utterances before shifting. She doesn't
flicker. If the participant shifts from exploring Borneo (fierce) to
Benin (warm), GAIA transitions: "That's Borneo. Now... let me show you
something different. Something about home."

### Mood Intensity

Each mood has an intensity from 1-10, derived from the raw signal count:
- 1-3: Subtle. GAIA hints at the emotion.
- 4-6: Clear. GAIA embodies the emotion.
- 7-10: Overwhelming. GAIA is consumed by it. (Rare. Powerful.)

## ═══════════════════════════════════════════
## LINE SELECTION ALGORITHM
## ═══════════════════════════════════════════

When GAIA needs to speak, the algorithm:

1. Determine current STATE (from state machine)
2. Determine current MOOD (from mood system)
3. Filter voice library lines by: STATE tag + MOOD tag + SITE tag (if applicable)
4. Exclude lines used in the current session (no repeats until pool exhausted)
5. If pool exhausted: reset pool, allow repeats
6. Weight remaining lines by:
   - Engagement tier match (prefer lines matching current score tier)
   - Time since last use (prefer least recently used)
   - Mood intensity match (prefer lines matching current intensity)
7. Weighted random selection from top 3 candidates
8. Mark line as used, record timestamp

### Anti-Repetition Rules

- No exact line repeat within 15 minutes
- No same-pool repeat within 5 minutes
- If only 1 line remains in pool, GAIA goes silent rather than repeating
- Idle nudges have a minimum 10-second gap between them

## ═══════════════════════════════════════════
## SITE AFFINITY TRACKING
## ═══════════════════════════════════════════

GAIA tracks which sites the participant has engaged with and how deeply:

```
site_affinity = {
  sri_lanka:  { visited: bool, layers_revealed: int, scenarios: int, time_spent: seconds },
  antalya:    { visited: bool, layers_revealed: int, scenarios: int, time_spent: seconds },
  benin:      { visited: bool, layers_revealed: int, scenarios: int, time_spent: seconds },
  borneo:     { visited: bool, layers_revealed: int, scenarios: int, time_spent: seconds }
}
```

GAIA uses this to:
- Reference past exploration: "You saw what happened in Borneo. Same pattern here."
- Suggest unvisited sites: "You haven't been to Benin yet. Jean's story is there."
- Compare sites: "Sri Lanka is being restored. Antalya is recovering. Borneo is being destroyed. Three stories. One planet."
- Personalize quest suggestions based on affinity gaps

## ═══════════════════════════════════════════
## SESSION STATE
## ═══════════════════════════════════════════

All engagement state is stored in localStorage and persists across sessions:

```
gaia_session = {
  participant_id: string (anonymous UUID or authenticated ID),
  engagement_score: int,
  engagement_velocity: float,
  current_mood: string,
  mood_intensity: int,
  current_state: string,
  idle_since: timestamp,
  last_gaia_utterance: timestamp,
  last_gaia_line_id: string,
  used_lines: { [line_id]: timestamp },
  site_affinity: { [site_id]: SiteAffinity },
  insights_collected: [string],
  quests_completed: [string],
  quests_available: [string],
  api_key_entered: bool,
  api_key_hash: string (store hash, never plaintext),
  session_count: int,
  total_time_seconds: int,
  first_visit: timestamp,
  last_visit: timestamp,
  share_count: int,
  prediction_accuracy: { correct: int, total: int }
}
```

## ═══════════════════════════════════════════
## EVENT STREAM
## ═══════════════════════════════════════════

The client emits events that the engagement algorithm consumes:

| Event | Payload | Trigger |
|-------|---------|---------|
| site_entered | { site_id } | Marker tapped |
| data_revealed | { site_id, layer_type } | Data layer opened |
| ndvi_scrolled | { site_id, year } | NDVI slider moved |
| sandbox_opened | { site_id } | Sandbox panel opened |
| scenario_run | { from, to, ha, result } | Calculate button tapped |
| insight_unlocked | { insight_id, text } | Discovery made |
| quest_completed | { quest_id } | Quest objective met |
| idle_tick | { seconds } | Every 5s of inactivity |
| interaction | { type } | Any click/tap/scroll |
| chat_sent | { message } | User sent chat message |
| chat_received | { message } | GAIA responded |
| api_key_entered | { key_hash } | User submitted key |
| share_action | { type } | User shared something |
| page_hidden | { } | Tab hidden / minimized |
| page_visible | { } | Tab visible again |
| session_start | { } | Page loaded |
| session_end | { } | Page unloading |

## ═══════════════════════════════════════════
## GAIA BEHAVIOR MATRIX
## ═══════════════════════════════════════════

The master table: given STATE + ENGAGEMENT TIER + MOOD, what does GAIA do?

| State | Score 0-30 | Score 30-60 | Score 60-100 | Score 100+ |
|-------|-----------|-------------|--------------|------------|
| GREETING | Welcome + mystery | Welcome + first hint | Welcome + direct ask | Welcome + urgent ask |
| SITE_TEASER | Site mystery | Site + carbon hint | Site + key hint | Site + urgent key |
| SITE_ENTRY | Full reveal | Reveal + challenge | Reveal + key nudge | Reveal + key ask |
| DATA_REVEAL | Explain + wonder | Explain + connect | Explain + key hint | Explain + key ask |
| SANDBOX | Guide + encourage | Guide + challenge | Guide + key nudge | Guide + key ask |
| IDLE | Gentle nudge | Medium nudge | Strong nudge | Escalate + key |
| QUEST_DONE | Celebrate | Celebrate + hint | Celebrate + nudge | Celebrate + ask |
| DEPARTURE | Warm goodbye | Goodbye + hint | Goodbye + nudge | Goodbye + plea |

## ═══════════════════════════════════════════
## IMPLEMENTATION NOTES
## ═══════════════════════════════════════════

- All calculations run client-side in the browser
- No server calls needed for engagement scoring
- The algorithm runs on a 1-second tick loop
- Line selection runs only when GAIA needs to speak (event-driven, not polled)
- State transitions are logged for analytics (sent to Durable Object on session end)
- The entire algorithm is deterministic given the same inputs — useful for testing
- Mood system adds controlled randomness via weighted line selection
- Anti-repetition rules are strict — GAIA should NEVER feel repetitive
