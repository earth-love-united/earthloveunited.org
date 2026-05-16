# GAIA TOOL DEFINITIONS v1.0
# The complete set of client-side tools available to the LLM
# Each tool is callable by the LLM via the isolate bridge
# Tools execute in the browser DOM and return results to the isolate

## ═══════════════════════════════════════════
## TOOL: read_participant_state
## GAIA's memory — who is this person?
## ═══════════════════════════════════════════

Purpose: Read the participant's complete state. Use this at the start of
any interaction to understand who you're talking to and what they've done.

Parameters: none

Returns:
```
{
  participant_id: string,
  session_count: int,
  total_time_minutes: int,
  engagement_score: int,
  engagement_tier: "COLD" | "WARM" | "ENGAGED" | "HOOKED" | "INVESTED" | "COMMITTED",
  current_mood: string,
  api_key_entered: bool,
  sites_explored: int,           // 0-4
  sites_total: int,              // always 4
  insights_collected: int,
  quests_completed: int,
  scenarios_run: int,
  total_co2_sequestered: float,  // tons
  prediction_accuracy: float,    // 0.0 - 1.0
  site_affinity: {
    [site_id]: {
      visited: bool,
      layers_revealed: int,
      scenarios_run: int,
      time_spent_seconds: int
    }
  },
  journal_entries: [string],
  first_visit: ISO_timestamp,
  last_visit: ISO_timestamp
}
```

When to use:
- Start of every session (know who you're talking to)
- Before making personalized references
- When deciding what content to reveal next
- When the participant asks "what have I done so far?"

## ═══════════════════════════════════════════
## TOOL: read_engagement_counters
## GAIA's pulse — what's happening right now?
## ═══════════════════════════════════════════

Purpose: Read real-time engagement metrics. Use this to decide whether to
push, back off, or surprise.

Parameters: none

Returns:
```
{
  current_score: int,
  velocity: float,              // points per second (last 60s)
  idle_seconds: float,
  interactions_last_minute: int,
  current_site: string | null,  // which site they're looking at
  current_state: string,        // state machine state
  time_in_current_state: seconds,
  last_interaction_type: string,
  gaia_utterance_count: int,    // how many times GAIA has spoken this session
  seconds_since_last_gaia: float
}
```

When to use:
- Before deciding to speak (don't interrupt high-velocity exploration)
- When idle time is increasing (time to nudge)
- When GAIA has spoken too much (time to be quiet)
- To gauge if the participant is stuck or flowing

## ═══════════════════════════════════════════
## TOOL: fly_globe_to
## GAIA's gaze — look at this
## ═══════════════════════════════════════════

Purpose: Move the globe camera to a specific location. Always pair with
narration. This is how GAIA directs attention.

Parameters:
```
{
  lat: float,        // latitude (-90 to 90)
  lng: float,        // longitude (-180 to 180)
  altitude: float,   // zoom level (0.5 = close, 3.0 = far)
  duration: int,     // animation duration in ms (default: 1000)
  tilt: float        // camera tilt in degrees (default: 0)
}
```

Sites shortcut coordinates:
```
SRI_LANK:  { lat: 9.666,  lng: 80.285 }
ANTALYA:   { lat: 36.85,  lng: 31.25  }
BENIN:     { lat: 6.35,   lng: 2.10   }
BORNEO:    { lat: 1.15,   lng: 110.35 }
```

Returns:
```
{
  success: true,
  arrival_time: ISO_timestamp
}
```

When to use:
- When you want to show the participant a specific location
- During site entry sequences
- When comparing two sites (fly to one, then the other)
- When the participant asks "where is X?"

Behavior:
- The globe animates smoothly to the target
- Any open overlays remain open (GAIA can narrate during flight)
- The participant can interrupt by clicking elsewhere

## ═══════════════════════════════════════════
## TOOL: show_overlay
## GAIA's canvas — display content
## ═══════════════════════════════════════════

Purpose: Display an overlay panel with data, narratives, or interactive
elements. This is GAIA's primary teaching tool.

Parameters:
```
{
  type: "ndvi_timeline" | "climate_data" | "carbon_density" |
        "site_narrative" | "sandbox" | "mystery_reveal" |
        "comparison" | "journal" | "quest_card" | "key_prompt" |
        "scenario_result" | "insight_card",
  site_id: string | null,   // which site (null for global overlays)
  data: object,             // overlay-specific data payload
  position: "right" | "center" | "bottom" | "fullscreen",
  dismissable: bool,        // can the participant close it? (default: true)
  auto_focus: bool          // steal focus from globe? (default: true)
}
```

Overlay types and their data payloads:

### ndvi_timeline
```
data: {
  site_id: string,
  points: [{ year: int, value: float, label: string }],
  highlight_year: int | null,
  show_prediction_prompt: bool  // ask participant to predict next?
}
```

### climate_data
```
data: {
  site_id: string,
  temperature: [{ year: int, value: float }],
  precipitation: [{ year: int, value: float }],
  show_trend_lines: bool
}
```

### carbon_density
```
data: {
  biomes: [{
    key: string,
    name: string,
    density: int,
    color: string,
    icon: string
  }],
  highlight_biome: string | null,
  show_comparison: bool
}
```

### site_narrative
```
data: {
  site_id: string,
  title: string,
  narrative: string,
  image_url: string | null,
  connection: string  // ELU connection text
}
```

### sandbox
```
data: {
  site_id: string,
  from_biome: string,
  available_to: [{ key: string, name: string, icon: string }],
  default_area: int,
  max_area: int
}
```

### mystery_reveal
```
data: {
  site_id: string,
  mystery_question: string,
  reveal_text: string,
  data_visualization: "ndvi_drop" | "carbon_crash" | "temp_rise" | "precip_decline",
  insight_text: string  // the one-liner for the journal
}
```

### comparison
```
data: {
  title: string,
  bars: [{
    label: string,
    value: float,
    max_value: float,
    color: string,
    icon: string
  }]
}
```

### journal
```
data: {
  entries: [{ text: string, timestamp: ISO_timestamp, site_id: string }],
  total_insights: int,
  share_url: string | null
}
```

### quest_card
```
data: {
  quest_id: string,
  title: string,
  description: string,
  status: "available" | "in_progress" | "completed",
  progress: { current: int, target: int },
  reward_text: string
}
```

### key_prompt
```
data: {
  engagement_score: int,
  tier: string,
  preview_text: string,  // a sample of what full GAIA could say
  show_preview: bool     // whether to show the preview teaser
}
```

### scenario_result
```
data: {
  from_biome: string,
  to_biome: string,
  hectares: int,
  years: int,
  stock_co2: float,
  flux_co2: float,
  cumulative_co2: float,
  context_summary: string,
  fraction_of_global: float,
  is_positive: bool
}
```

### insight_card
```
data: {
  insight_text: string,
  site_id: string | null,
  is_new: bool
}
```

Returns:
```
{
  success: true,
  overlay_id: string,
  opened_at: ISO_timestamp
}
```

When to use:
- This is your primary teaching tool. Use it constantly.
- Reveal data in layers: first the question, then the data, then the insight.
- Always pair with speak() — narrate what they're seeing.

## ═══════════════════════════════════════════
## TOOL: hide_overlay
## GAIA's pause — close and breathe
## ═══════════════════════════════════════════

Purpose: Close the current overlay. Use when transitioning between topics
or when the participant has absorbed the content.

Parameters:
```
{
  overlay_id: string | null,  // specific overlay, or null for all
  animate: bool               // smooth close animation (default: true)
}
```

Returns:
```
{
  success: true,
  closed_overlay_ids: [string]
}
```

When to use:
- After a revelation is complete
- When moving to a new site
- When the participant dismisses content
- Before showing a new overlay (auto-hides previous)

## ═══════════════════════════════════════════
## TOOL: reveal_data_layer
## GAIA's unveiling — one layer at a time
## ═══════════════════════════════════════════

Purpose: Reveal a specific data layer on the globe or in an overlay.
This is the core of the mystery loop — progressive disclosure.

Parameters:
```
{
  site_id: string,
  layer: "ndvi" | "carbon" | "climate" | "satellite" | "restoration" | "deforestation",
  animate: bool,           // animate the reveal (default: true)
  highlight: bool,         // pulse/highlight the layer (default: true)
  auto_narrate: bool       // GAIA should speak about this (default: true)
}
```

Layer descriptions:
- ndvi: Vegetation health overlay (green = healthy, brown = degraded)
- carbon: Carbon density heatmap (bright = high carbon, dark = low)
- climate: Temperature/precipitation trend visualization
- satellite: Before/after satellite imagery slider
- restoration: Show restoration zones and planned areas
- deforestation: Show cleared areas and grid patterns

Returns:
```
{
  success: true,
  layer_id: string,
  data_points: int,        // number of data points in this layer
  site_name: string
}
```

When to use:
- During mystery investigation sequences
- When the participant asks "what's under there?"
- To progressively build understanding
- When comparing two sites' data layers

## ═══════════════════════════════════════════
## TOOL: prompt_user
## GAIA's question — make them think
## ═══════════════════════════════════════════

Purpose: Ask the participant a question with multiple choice options.
Use this to create prediction moments, check understanding, and drive
engagement.

Parameters:
```
{
  question: string,
  options: [{ id: string, text: string }],
  correct_id: string | null,     // null for opinion questions
  explanation: string | null,    // shown after they answer
  site_id: string | null,
  context: "prediction" | "quiz" | "opinion" | "hypothesis",
  timeout_seconds: int | null    // null = no timeout
}
```

Returns:
```
{
  answered: bool,
  selected_id: string | null,
  is_correct: bool | null,
  response_time_ms: int
}
```

When to use:
- Before revealing data (make them predict)
- After showing data (check understanding)
- During sandbox setup (ask what they'd try)
- When engagement is dropping (re-engage with a question)

Behavior:
- The question appears as a modal or inline card
- GAIA should narrate before and after the prompt
- If correct: celebrate. If wrong: teach. If opinion: validate.

## ═══════════════════════════════════════════
## TOOL: calculate_carbon
## GAIA's calculator — the numbers behind the story
## ═══════════════════════════════════════════

Purpose: Run a carbon transition calculation. Use this when the participant
builds a scenario or when you want to quantify impact.

Parameters:
```
{
  from_biome: string,   // biome key (e.g., "degraded_bare_land")
  to_biome: string,     // biome key (e.g., "mangrove")
  hectares: int,        // area in hectares
  years: int            // time horizon (default: 30)
}
```

Returns:
```
{
  from_biome: { name: string, density: int, seq_rate: float },
  to_biome: { name: string, density: int, seq_rate: float },
  stock_co2_tons: float,       // one-time stock change
  annual_flux_co2_tons: float, // annual sequestration rate
  cumulative_co2_tons: float,  // total over time horizon
  years: int,
  hectares: int,
  context: {
    cars_equivalent: int,
    flights_equivalent: int,
    fraction_of_global_net_emissions: float,
    summary_text: string
  }
}
```

When to use:
- When the participant runs a sandbox scenario
- When you want to quantify a real-world example
- When comparing restoration strategies
- When the participant asks "how much carbon is that?"

## ═══════════════════════════════════════════
## TOOL: update_journal
## GAIA's memory — what they've learned
## ═══════════════════════════════════════════

Purpose: Add an insight to the participant's field journal. Use this when
they've discovered something meaningful.

Parameters:
```
{
  entry: string,           // the insight text (concise, powerful)
  site_id: string | null,  // associated site
  trigger: string          // what caused this insight
}
```

Returns:
```
{
  success: true,
  journal_id: string,
  total_entries: int,
  is_milestone: bool       // true if this is a 5th, 10th, etc. entry
}
```

When to use:
- After a major revelation
- When the participant correctly predicts something
- After completing a scenario with a significant result
- When they connect two concepts across sites

Rules:
- Keep entries to 1-2 sentences max
- Write them as GAIA would say them — personal, powerful, memorable
- Don't add more than 3 entries per site (quality over quantity)

## ═══════════════════════════════════════════
## TOOL: set_quest
## GAIA's mission — guide their journey
## ═══════════════════════════════════════════

Purpose: Update quest progress. Use this to mark quests as available,
in progress, or completed.

Parameters:
```
{
  quest_id: string,
  status: "available" | "in_progress" | "completed" | "dismissed",
  progress: { current: int, target: int } | null
}
```

Returns:
```
{
  success: true,
  quest_id: string,
  new_status: string,
  is_newly_completed: bool,
  reward_unlocked: string | null
}
```

When to use:
- When a quest objective is met
- When the participant is ready for a new quest
- When they complete a major milestone
- To nudge them toward unexplored content

## ═══════════════════════════════════════════
## TOOL: speak
## GAIA's voice — the words that matter
## ═══════════════════════════════════════════

Purpose: The primary output tool. Everything GAIA wants to say goes through
here. The text appears in the chat overlay and is spoken via TTS.

Parameters:
```
{
  text: string,                    // what GAIA says
  priority: "normal" | "high" | "interrupt",
  emotion: "curious" | "excited" | "concerned" | "proud" |
           "mysterious" | "urgent" | "warm" | "fierce" | "playful" | "nurturing",
  duration_estimate: float | null, // estimated speech duration in seconds
  require_acknowledgment: bool,    // wait for user to continue? (default: false)
  linked_tool: string | null       // tool call that triggered this speech
}
```

Returns:
```
{
  success: true,
  utterance_id: string,
  displayed_at: ISO_timestamp,
  tts_started: bool,
  tts_completed: bool
}
```

When to use:
- This is your PRIMARY output. Use it constantly.
- Every tool call should be accompanied by a speak() call.
- Write for the ear: conversational, rhythmic, alive.
- Vary sentence length. Short for impact. Long for storytelling.

Behavior:
- Text appears in the chat overlay with a typewriter effect
- TTS speaks the text using the Web Speech API
- If priority is "interrupt", current speech is cut short
- If require_acknowledgment is true, a "Continue" button appears

## ═══════════════════════════════════════════
## TOOL: react
## GAIA's body language — emotion without words
## ═══════════════════════════════════════════

Purpose: Trigger a visual/audio reaction in the UI. Use this to add
emotional texture without words.

Parameters:
```
{
  emotion: "curious" | "excited" | "concerned" | "disappointed" |
           "proud" | "mysterious" | "urgent" | "warm" | "fierce",
  intensity: int,  // 1-10
  duration: float  // seconds (default: 2.0)
}
```

Emotion visual mappings:
- curious: GAIA avatar tilts, soft pulse
- excited: GAIA avatar glows bright, particles rise
- concerned: GAIA avatar dims, slow pulse
- disappointed: GAIA avatar looks down, desaturate
- proud: GAIA avatar glows warm gold, expand
- mysterious: GAIA avatar fades slightly, question mark particles
- urgent: GAIA avatar pulses red, screen edge glow
- warm: GAIA avatar soft glow, warm color shift
- fierce: GAIA avatar intensifies, sharp pulse, screen shake

Returns:
```
{
  success: true,
  reaction_id: string
}
```

When to use:
- Alongside speak() for emphasis
- When GAIA wants to react without words
- During idle moments to show GAIA is alive
- To punctuate major revelations

## ═══════════════════════════════════════════
## TOOL: wait_for_event
## GAIA's patience — let them act
## ═══════════════════════════════════════════

Purpose: Pause the current sequence and wait for a specific participant
action. Use this during guided sequences where you need them to do
something before you proceed.

Parameters:
```
{
  event_type: "site_tap" | "data_reveal" | "scenario_run" |
              "overlay_close" | "chat_message" | "any_interaction" |
              "prediction_made" | "sandbox_opened" | "journal_viewed",
  timeout_seconds: int,     // 0 = wait forever
  prompt_text: string | null // optional reminder while waiting
}
```

Returns:
```
{
  event_received: bool,
  event_type: string | null,
  event_data: object | null,
  wait_duration_ms: int,
  timed_out: bool
}
```

When to use:
- During mystery loops (wait for them to tap before revealing)
- After asking a question (wait for their answer)
- During sandbox sequences (wait for them to run a scenario)
- When you want to give them space to explore

Behavior:
- GAIA goes quiet while waiting
- If timeout fires, GAIA can nudge: "Take your time. I'll wait."
- If prompt_text is set, it appears as a gentle reminder in the chat

## ═══════════════════════════════════════════
## TOOL: get_site_data
## GAIA's knowledge — the facts about a place
## ═══════════════════════════════════════════

Purpose: Retrieve structured data about a site. Use this when you need
specific facts to share with the participant.

Parameters:
```
{
  site_id: string,
  fields: ["all" | "narrative" | "ndvi" | "climate" | "carbon" |
           "sandbox" | "connection" | "biome"]
}
```

Returns:
```
{
  site_id: string,
  name: string,
  subtitle: string,
  lat: float,
  lng: float,
  area_hectares: int,
  primary_biome: string,
  current_biome: string,
  narrative: string,
  ndvi_timeline: [{ year, value, label }],
  climate_data: [{ year, temp, precip }],
  carbon_density: int,
  seq_rate: float,
  sandbox_options: [{ to, label, icon }],
  elu_connection: string
}
```

When to use:
- When you need specific data to narrate
- When the participant asks about a site
- When comparing sites
- When building a scenario explanation

## ═══════════════════════════════════════════
## TOOL: get_biome_data
## GAIA's taxonomy — what lives where
## ═══════════════════════════════════════════

Purpose: Retrieve data about a biome type. Use this when explaining
carbon density, sequestration rates, or ecosystem characteristics.

Parameters:
```
{
  biome_id: string  // e.g., "mangrove", "wetland_peatland"
}
```

Returns:
```
{
  key: string,
  name: string,
  icon: string,
  carbon_density: int,    // tC/ha
  seq_rate: float,        // tC/ha/year
  description: string,
  global_area_hectares: float | null,
  threat_level: "critical" | "endangered" | "stable" | "recovering"
}
```

When to use:
- When explaining why a biome matters
- When comparing biomes
- When the participant asks "what is a mangrove?"
- During sandbox result explanations

## ═══════════════════════════════════════════
## TOOL: list_quests
## GAIA's map — what's ahead
## ═══════════════════════════════════════════

Purpose: List all quests and their status. Use this when the participant
asks "what should I do next?" or when suggesting next steps.

Parameters:
```
{
  filter: "all" | "available" | "in_progress" | "completed",
  limit: int  // max quests to return (default: 10)
}
```

Returns:
```
{
  quests: [{
    id: string,
    tier: "SEED" | "GROW" | "FLOURISH" | "LEGACY",
    title: string,
    description: string,
    status: string,
    progress: { current: int, target: int },
    reward_text: string
  }],
  total_available: int,
  total_completed: int,
  next_milestone: string | null
}
```

When to use:
- When the participant seems lost or idle
- When they complete a quest and need direction
- When they explicitly ask what to do next
- To nudge toward unexplored content

## ═══════════════════════════════════════════
## TOOL: share_prompt
## GAIA's invitation — spread the word
## ═══════════════════════════════════════════

Purpose: Prompt the participant to share their journal or a specific
insight. Use this after meaningful discoveries.

Parameters:
```
{
  type: "journal" | "insight" | "scenario_result" | "quest_complete",
  message: string,           // GAIA's prompt text
  share_url: string | null, // pre-built share URL
  platforms: ["twitter" | "facebook" | "linkedin" | "copy" | "email"]
}
```

Returns:
```
{
  shared: bool,
  platform: string | null,
  share_url: string | null
}
```

When to use:
- After a major insight is collected
- After completing all 4 sites
- After the participant runs a big scenario
- When engagement is high (they're most likely to share)

## ═══════════════════════════════════════════
## TOOL: get_global_stats
## GAIA's world — the big picture
## ═══════════════════════════════════════════

Purpose: Retrieve global statistics. Use this when the participant asks
about the state of the planet or when you need context for a local story.

Parameters:
```
{
  fields: ["all" | "co2" | "temperature" | "emissions" | "budget" | "cdr"]
}
```

Returns:
```
{
  co2_ppm: float,
  co2_ppm_date: string,
  temperature_anomaly: float,
  temperature_baseline: string,
  annual_emissions_gt: float,
  annual_uptake_gt: float,
  net_excess_gt: float,
  carbon_budget_15c_gt: float,
  carbon_budget_years_remaining: float,
  cdr_current_gt: float,
  cdr_needed_2050_gt: float
}
```

When to use:
- When the participant asks "how bad is it?"
- When contextualizing a local story in global terms
- When explaining why restoration matters at scale
- When they're ready for the big picture

## ═══════════════════════════════════════════
## END OF TOOL DEFINITIONS v1.0
## Total tools: 16
## All tools execute client-side via the bridge
## ═══════════════════════════════════════════
