# 🌍 GLOBE EVENT: THE BURN SCAR
## Interactive Learning Experience Design Document

**Knowledge Item ID:** `event.antalya.burn-scar`
**Location:** Manavgat, Antalya, Turkey (36.85°N, 31.25°E)
**Type:** 🔥 Crisis Investigation
**Estimated Duration:** 5–8 minutes
**Difficulty:** Entry-level (unlocks first)
**Emotional Tone:** Wonder → Disbelief → Urgency → Agency

---

## Pedagogical Foundation

This event is built on **constructivist learning theory** — people learn by doing, by being wrong, and by having their mental models corrected with evidence. Each of the 7 steps below serves a specific cognitive function drawn from learning science:

| Step | Learning Mechanism | Emotional State |
|------|---|---|
| 1. HOOK | Curiosity gap creation | Intrigue, slight unease |
| 2. EXPLORE | Free-form discovery (constructivism) | Wonder, ownership |
| 3. PREDICT | Retrieval practice / hypothesis commitment | Confidence, vulnerability |
| 4. REVEAL | Corrective feedback + cognitive conflict | Surprise, "aha" moment |
| 5. CONNECT | Schema building / systems thinking | Perspective, scale awareness |
| 6. ACT | Situated decision-making (agency) | Empowerment, responsibility |
| 7. REFLECT | Metacognition + narrative consolidation | Pride, identity shift |

**Core design principle:** The user should never feel lectured. GAIA is a companion, not a teacher. The data speaks. The user interprets.

---

## The 7-Step Learning Experience

---

### STEP 1: HOOK — "What Happened Here?"

**Purpose:** Create an irresistible knowledge gap. The user must know what happened.

**Experience:**

The user arrives at the globe. Among the pulsing event pins, one glows orange-red over Antalya, Turkey. It pulses faster than the others. A small label reads:

> 🔥 **MANAVGAT, 2021** — *Something happened here. 60,000 hectares. 4 days.*

When the user hovers, GAIA's bubble appears — not with a greeting, but with a question:

> *"In July 2021, this forest was green. Four days later, it was black. The satellite watched it happen in real time. Do you want to see what the fire did?"*

The user clicks the pin.

**Visual design:**
- The globe slowly orbits to center on Antalya
- The map zooms from orbital view to ~50km altitude
- A ghostly overlay fades in: the burn scar boundary, glowing faint red
- No text blocks. No walls of information. Just the scar on the Earth, silently burning in the user's mind

**Key design choice:** No explanation yet. The landscape speaks. The user's first question is their own — *"How?" "Why?" "What grows back?"* — which is exactly where we need them to be.

---

### STEP 2: EXPLORE — "Play With Time"

**Purpose:** Let the user discover patterns before being told what to see. Active > passive.

**Experience:**

A timeline slider appears along the bottom of the globe view. It spans 2000 to 2026. The user can drag it and watch the landscape change.

**What they see as they drag:**

- **2000–2019:** Dense, dark-green forest canopy. The NDVI values hover around 0.72. Stable. Healthy. Mediterranean pine thriving.
- **2020:** A slight dip — drought stress. NDVI drops to 0.70. A tooltip reads: *"The forest was already thirsty."*
- **July 2021:** The slider hits 2021 and the landscape *drops*. The green vanishes. In a single frame, the view shifts from dense forest to brown scar. NDVI plummets from 0.72 to 0.18. The user sees it happen — they control the speed, so they can go frame by frame if they want.
- **2022–2026:** Scrub. Grass. Not nothing — but a fraction of what was there. The most recent reading (2025) shows NDVI at 0.38.

The slider stops. GAIA speaks:

> *"You just watched twenty years of forest vanish in a single slider move. From 0.72 — healthy pine — to 0.18. That's a 75% drop in vegetation. In four days."*

**Interactive element — the comparison tool:**

Two "snapshots" are pinned to the screen. The user can drag a divider (before/after) across the same area:

| Before (2020) | After (2021) |
|---|---|
| NDVI: 0.72 | NDVI: 0.18 |
| Dense Mediterranean pine | Burn scar / bare soil |
| ~300 tC/ha stored | ~15 tC/ha remaining |
| Canopy temperature: 22°C | Surface temperature: 41°C |

**What makes this step work:**
- No quiz. No challenge yet. Just exploration.
- The user controls the pace — they can linger at 2020 or race to 2025
- The data is *visual*, not numerical — the color change IS the data
- GAIA provides narration only when the user pauses, not constantly

---

### STEP 3: PREDICT — "Test Your Instinct"

**Purpose:** Force commitment to a hypothesis. Being wrong is the point — it primes the brain for the reveal.

**Experience:**

After the exploration phase, the screen shifts to a focused question. GAIA's bubble is front and center:

> *"Now you've seen the damage. Here's what I want to know — how good is your intuition? Answer before I show you the data."*

**The prediction question:**

*"In 2025, four years after the fire, how much of the forest has recovered?"*

Three options appear (Brilliant-style):

- **A:** Nearly full recovery — 🌲🌲🌲 "The forest is mostly back"
- **B:** Partial recovery — 🌿🌿 "Scrub and grass, some young trees"
- **C:** Almost nothing — 🪨 "Mostly bare, only faint regrowth"

**The psychology at work:**
- Option A is tempting — people *want* nature to recover quickly
- Option C seems too pessimistic
- Option B feels like a safe middle ground — and it's wrong

**What happens after they choose:**

The user taps their answer. Regardless of correctness, GAIA responds with genuine engagement:

**If they chose A:**
> *"Optimism feels right, doesn't it? But forests don't heal that fast. Let me show you what the satellite actually sees..."*

**If they chose B:**
> *"Close! But you're being generous. The truth is harder to look at."*

**If they chose C:**
> *"You see the world as it is. Most people want to believe recovery is faster than it is. Let's check."*

**XP:** +15 regardless of correctness. Prediction attempts are rewarded, not punished.

---

### STEP 4: REVEAL — "The Data Tells the Story"

**Purpose:** The "aha" moment. Deliver the true answer with data that's impossible to argue with.

**Experience:**

The globe view returns, but now it's augmented. The user sees:

1. **The Satellite Proof** — A side-by-side comparison:

   | Sentinel-2 Image (2020) | Sentinel-2 Image (2021) | Sentinel-2 Image (2025) |
   |---|---|---|
   | ![Dense pine forest — deep green] | ![Massive burn scar — dark brown] | ![Sparse scrub — patchy green] |

2. **The Recovery Curve** — A simple, clear line chart:

```
NDVI
0.8 |    ·
0.7 |  · ·
0.6 | ·
0.5 |
0.4 |              ·
0.3 |                · ·
0.2 |       ×
0.1 |  ×
     |----|----|----|----|----|----|
     2018 2019 2020 2021 2022 2023 2024 2025
```

The `×` markers are human estimates. The `·` markers are actual Sentinel-2 measurements. The user can see exactly where human hope diverges from satellite reality.

3. **The Carbon Math:**

   *"This forest held approximately 300 tonnes of CO₂ per hectare before the fire. After the burn: roughly 15 tC/ha. That's a loss of 285 tonnes per hectare, across 60,000 hectares. The total carbon released was approximately... **17.1 million tonnes of CO₂**."*

   A visual comparison appears: *"That's like taking 3.7 million cars off the road for a year — then reversing it. All that stored carbon, gone in 4 days."*

4. **The Honest Verdict:**

   > *"This is what the satellite sees. The forest is 4 years into recovery. NDVI has climbed from 0.18 to 0.38 — real progress, but the original forest was at 0.72. At current recovery rates, full restoration would take 30–60 years. Some species may never return without help."*

**Design principle:** Reveal is not a lecture. Every claim is backed by a visible data point the user can inspect. No assertion without evidence.

**XP:** +30 for completing the reveal stage.

---

### STEP 5: CONNECT — "This Is Not Just Turkey"

**Purpose:** Move from local insight to systemic understanding. Build mental models that transfer.

**Experience:**

The view pulls back from Antalya. The globe shrinks. Other pins light up around the world:

> *"The Antalya fire isn't unique. In 2021 alone, catastrophic fires burned millions of hectares globally. Here's where else the same story is playing out..."*

**The Connection Map** shows fire events from the past 5 years:
- 🔥 **Siberia (2021)** — 18.8 million hectares. Record CO₂ emissions.
- 🔥 **California (2020)** — 1.7 million hectares. Worst fire season in state history.
- 🔥 **Amazon (2019–2021)** — Deforestation fires, not natural. Systemic clearing.
- 🔥 **Greece (2023)** — Mediterranean pattern. Same climate zone as Antalya.
- 🔥 **Australia (2019–2020)** — "Black Summer." 3 billion animals affected.

Each dot, when tapped, shows a 15-second satellite timelapse of that region.

**GAIA provides the frame:**

> *"Every one of these fires released carbon that took centuries to accumulate. The pattern is the same: heat → drought → ignition → burn → CO₂ release → more heat. It's a feedback loop. And it's accelerating."*

**The key insight panel:**

*"Climate change doesn't just cause fires. Fires cause climate change. Every burning forest releases stored carbon, which traps more heat, which creates more drought, which creates more fires. Scientists call this a **positive feedback loop** — the climate's version of a vicious cycle."*

**Optional deep dive:** The user can tap any comparison fire to see a "Match Score" — how similar the Antalya fire's NDVI pattern is to that event. This teaches pattern recognition without explicit instruction.

**XP:** +25 for exploring 2+ connected events, +10 for exploring just the initial set.

---

### STEP 6: ACT — "You're In Charge"

**Purpose:** Transform understanding into agency. The user is no longer a spectator — they're making a decision.

**Experience:**

The scene returns to the Antalya region. But now GAIA speaks differently:

> *"The forest isn't going to heal itself — not fast enough, not completely. You're the head of restoration for this region. You have a budget. You have three choices. Pick one."*

**The Scenario Builder:**

Three options, each with real tradeoffs and projected outcomes:

---

**OPTION A — Active Reforestation** 🌲
*"Plant fast-growing Mediterranean pine seedlings. Monitor and maintain for 10 years."*

- **Cost:** ~$5,000/hectare
- **Projected NDVI in 10 years:** 0.55 (not full recovery, but significant)
- **Carbon sequestered:** ~150 tC/ha over 10 years
- **Risks:** Seedling survival ~60%. Monoculture vulnerability. Expensive at scale.
- **Timeline to meaningful canopy:** 5–7 years

**OPTION B — Assisted Natural Regeneration** 🌿
*"Protect the area from human interference. Let nature do the work."*

- **Cost:** ~$500/hectare (fencing, monitoring only)
- **Projected NDVI in 10 years:** 0.45 (slow but steady)
- **Carbon sequestered:** ~80 tC/ha over 10 years
- **Risks:** Invasive species may dominate. No guarantee of original species return. Slow.
- **Timeline to meaningful canopy:** 15–25 years

**OPTION C — Mixed Approach** 🔀
*"Reforest the core areas. Let peripheral zones regenerate naturally. Create firebreaks."*

- **Cost:** ~$2,500/hectare
- **Projected NDVI in 10 years:** 0.50
- **Carbon sequestered:** ~100 tC/ha over 10 years
- **Risks:** Requires balanced management. More complex to execute.
- **Timeline to meaningful canopy:** 7–12 years

---

**The user selects an option.** The globe animates: the burn scar fills in based on their choice, showing projected satellite imagery 10 years from now. The NDVI curve continues forward with their chosen trajectory overlaid.

A results card appears:

> *"You chose Active Reforestation. In 10 years, this area is projected to store approximately 36,000 additional tonnes of carbon across the 2,500 hectares you've targeted. That's the equivalent of removing 7,800 cars from the road annually."*

> *"But it will cost approximately $12.5 million. Where does that money come from? Who pays to put the forest back?"*

**Why this step matters:**
- Every option is plausible. None is "right" — they're tradeoffs.
- The user sees the math: cost vs. speed vs. risk vs. carbon return
- GAIA doesn't judge the choice — she explains the consequences
- The connection to ELU and funding is explicit, not hidden

**XP:** +30 for completing the scenario. The scenario choice is recorded in the user's profile and journal.

---

### STEP 7: REFLECT — "What Did You Witness?"

**Purpose:** Consolidate learning through reflection. Create a personal artifact the user can keep and share.

**Experience:**

After the decision, the screen settles into a calm, summary view. GAIA's voice shifts to something quieter, more personal:

> *"You've just investigated a real climate disaster. You've seen what satellite data reveals, you've tested your assumptions, and you've made a decision about how to respond. That's not something most people do. Take a moment — what's the one thing you learned that you didn't expect?"*

**The Reflection Interface:**

Three elements:

**1. Personal Insight Card**
The user sees a summary of what they did and learned:

```
╔══════════════════════════════════════════════════╗
║         🔥 ANTYALA FIRE INVESTIGATION           ║
║              Completed · ⭐⭐⭐                  ║
║                                                  ║
║  What happened: Mediterranean pine forest        ║
║  burned 60,000 hectares in 4 days (July 2021)    ║
║                                                  ║
║  Key insight: Forest recovery takes decades,     ║
║  not years. Meanwhile, the carbon is in the      ║
║  atmosphere accelerating the cycle.              ║
║                                                  ║
║  Your decision: Active Reforestation             ║
║  Projected impact: +36,000 tCO₂ over 10 years    ║
╚══════════════════════════════════════════════════╝
```

**2. Journal Prompt (optional)**
A text field invites the user to write — or AI-generates — a journal entry:

> *"The forest at Manavgat looked healthy for centuries. Then four days in July destroyed what took nature thousands of years to build. I chose active reforestation because speed matters when the climate is already out of balance..."*

If they tap "Add to Journal," this goes into `GAIA_JOURNAL` and they earn the journal XP signal.

**3. Share Card**
A visually striking card they can save or screenshot:

> 🔥 **I investigated the Antalya Wildfire.**
> 
> I watched 60,000 hectares burn in 4 days.
> I learned what NDVI reveals that the eye can't.
> I chose how to rebuild.
> 
> *Earth Love United · One Earth*

---

## What Happens After Step 7

**Unlocks:**
- The Antalya pin changes from 🔥 pulsing to 🟢 (completed)
- Two new events unlock:
  - 🌱 **"Plant a Forest"** at Sri Lanka (Restoration Lab) — *"You've seen what fire does. Now see what restoration looks like."*
  - 📊 **"The Carbon Cycle"** at Pacific Ocean (Data Dive) — *"That carbon from the Antalya fire? Here's where it's going now."*

**GAIA's follow-up message:**
> *"You've completed your first investigation. Three more fires are visible from space. California. Siberia. The Amazon. Each one has a story like this one's. And at our four project sites, different stories are being written — stories of restoration. Ready to see the other side?"*

---

## The Event as a Data Structure

For the dev, this event maps to:

```json
{
  "id": "event.antalya.burn-scar",
  "title": "The Burn Scar",
  "type": "crisis-investigation",
  "location": { "lat": 36.85, "lng": 31.25, "label": "Antalya, Turkey" },
  "difficulty": 1,
  "duration_minutes": "5-8",
  "prerequisites": [],
  "unlocks_after": ["event.sri_lanka.restoration-lab", "event.data.carbon-cycle"],
  "steps": [
    { "step": 1, "type": "hook", "interaction": "globe-hover", "duration": "30s" },
    { "step": 2, "type": "explore", "interaction": "timeline-slider", "duration": "60-90s" },
    { "step": 3, "type": "predict", "interaction": "multiple-choice", "duration": "15s" },
    { "step": 4, "type": "reveal", "interaction": "satellite-comparison", "duration": "60s" },
    { "step": 5, "type": "connect", "interaction": "global-map", "duration": "45-60s" },
    { "step": 6, "type": "act", "interaction": "scenario-builder", "duration": "60s" },
    { "step": 7, "type": "reflect", "interaction": "journal+share", "duration": "30s" }
  ],
  "rewards": {
    "xp": { "predict": 15, "reveal": 30, "connect": 25, "act": 30, "total": 100 },
    "badge": "fire-investigator",
    "journal_entry": true,
    "share_card": true
  },
  "gdpr_note": "All data is local. No user tracking. No account required."
}
```

---

## Design Principles for ALL Future Events

Every globe event should follow these rules:

1. **The first frame has no words.** Let the place speak. A photo, a satellite view, a single striking fact on hover.
2. **The user acts before they're taught.** Explore → Predict → Learn. Never the reverse.
3. **Wrong answers are better than right answers.** Being wrong creates the memory. The correction is the lesson.
4. **Every fact must be traceable to a data source.** NDVI from Sentinel-2. CO₂ from IPCC. Temperatures from Open-Meteo. If we can't cite it, we don't show it.
5. **GAIA speaks like a companion, not a lecturer.** She asks questions before giving answers. She celebrates discovery, not compliance.
6. **The experience should feel like 5 minutes, not a lecture.** If it runs over 8 minutes, it's too long for a single sitting.
7. **Exit at any point, return at any point.** Progress saves to local storage. A half-finished event is never lost.
8. **The reward is understanding, not points.** Points unlock access to more events, not virtual badges for their own sake.

---

## Recommended Event Pipeline (What to Build Next)

| Priority | Event | Location | Type | Leverages |
|---|---|---|---|---|
| 1 | The Burn Scar | Antalya | 🔥 Crisis Investigation | **This document** ← build first |
| 2 | Resurrection Forest | Sri Lanka | 🌱 Restoration Lab | Step-by-step replanting scenario |
| 3 | The Green Lie | Borneo | ❓ Data Detective | "Why is an oil plantation green but 96% less carbon?" |
| 4 | Homecoming | Benin | 🌱 Restoration Lab + Personal | Jean's legacy, mangrove restoration |
| 5 | The Carbon Engine | Pacific Ocean | 📊 Data Dive | Carbon cycle as interactive diagram |
| 6 | The 20 Gigaton Problem | Industrial N. Hemisphere | 📊 Data Dive | Emissions by country, per capita |
| 7 | Biome Explorer | Global (8 stops) | 🌱 Field Investigation | Compare biomes, carbon density |
| 8 | Policy Room | COP31 venue | 🏛️ Policy Brief | "You're a delegate. Negotiate." |

---

## Metadata

- **Author:** Earth Love United Foundation
- **Version:** 1.0 — Conceptual Design
- **License:** CC-BY-4.0
- **Status:** Awaiting development implementation
- **Relation:** Knowledge Item → `event.antalya.burn-scar`
- **Connection:** Feeds into `REGISTRY`, `NDVI_VERIFIER`, `GAIA_ENGAGEMENT`, `GAIA_JOURNAL` modules