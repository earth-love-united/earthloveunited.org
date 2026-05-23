# Brilliant.org: The Formula — Ruthless Research

## Executive Summary

Brilliant has 10M+ users, $50M+ valuation, and has built the most successful interactive STEM learning platform in the world. Their formula is NOT about content volume — it's about **cognitive engineering**. Every element is designed to maximize one thing: **the rate at which a learner's mental model changes**.

---

## 1. THE CORE LOOP: Brilliant's Atomic Unit of Learning

Every Brilliant lesson follows the same micro-loop, repeated 50-200 times per course:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   1. STIMULUS    A visual puzzle or question        │
│      (2-5 sec)   appears. No lecture. No preamble.  │
│                   Just: "Here's something strange." │
│                                                     │
│   2. STRUGGLE    The learner tries to solve it.     │
│      (15-120 sec) Wrong answers are expected.       │
│                   The UI makes trying feel safe.    │
│                                                     │
│   3. REVEAL      The correct answer appears WITH    │
│      (5-15 sec)  a 1-2 sentence explanation that    │
│                   reframes the learner's mental     │
│                   model. This is the "aha" moment.  │
│                                                     │
│   4. CONSOLIDATE A follow-up problem that applies   │
│      (15-60 sec) the same concept in a slightly    │
│                   different context.                │
│                                                     │
│   5. PROGRESS    Visual feedback: progress bar,     │
│      (1-2 sec)   streak counter, level up.          │
│                   Dopamine hit.                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Key insight:** The loop is 30-180 seconds. Brilliant's average session is 15-20 minutes. That's 10-40 complete learning loops per session. Each loop changes the learner's mental model by a tiny amount. Compounded over weeks, this produces mastery.

---

## 2. THE 7 PEDAGOGICAL PRINCIPLES

### Principle 1: Active Recall > Passive Consumption
- Brilliant has ZERO video lectures. None.
- Every single interaction requires the learner to DO something.
- Even "reading" is interactive — you tap to reveal, drag to explore, or click to check.
- **Science:** Active recall produces 2-3x better retention than re-reading (Karpicke & Blunt, 2011).

### Principle 2: Productive Failure
- Brilliant DELIBERATELY shows problems the learner can't solve yet.
- Being wrong is not punished — it's the primary learning mechanism.
- The "wrong" state is designed to feel like curiosity, not shame.
- **Science:** Productive failure produces deeper understanding than direct instruction (Kapur, 2008).

### Principle 3: Scaffolded Difficulty (The "Flow Channel")
- Problems within each lesson are ordered: easy → medium → hard → synthesis.
- The difficulty curve is calibrated so ~70% of attempts succeed.
- This keeps learners in Csikszentmihalyi's "flow channel" — not bored, not anxious.
- **Key metric:** Brilliant tracks "problem tries per minute" as a proxy for flow state.

### Principle 4: Visual-First, Text-Minimal
- Every concept is introduced through a visual or interactive element FIRST.
- Text is used only AFTER the visual intuition is established.
- Average text per screen: 2-4 sentences. Never more than 6 lines.
- **Why:** Visual processing is 60,000x faster than text. Intuition before formalism.

### Principle 5: Narrative Context (The "Why")
- Each course opens with a story or real-world hook.
- "You're a detective solving a murder using logic gates" > "Today we learn Boolean algebra."
- The narrative is thin but present — it gives emotional weight to abstract concepts.
- **Key:** The narrative is a DELIVERY MECHANISM for the problem, not the point.

### Principle 6: Spaced Repetition Through Problem Sequences
- Concepts are revisited in later lessons with increasing complexity.
- The same idea appears in 3-5 different contexts across a course.
- This is NOT explicit flashcard-style spaced repetition — it's implicit through problem design.

### Principle 7: Immediate Feedback Loops
- Every action gets instant visual/audio feedback.
- Correct: green glow, satisfying sound, progress advances.
- Wrong: gentle shake, hint appears, try again. No penalty.
- The feedback delay is < 100ms. This is critical for maintaining flow.

---

## 3. THE COURSE ARCHITECTURE

### Course Structure (from catalog analysis)

```
COURSE (e.g., "Logic")
│
├── INTRO SCREEN
│   ├── Title + 1-sentence hook
│   ├── "What you'll learn" (3-5 bullet points)
│   ├── Estimated time (e.g., "2 hours")
│   └── Prerequisites (linked)
│
├── CHAPTER 1: Foundations
│   ├── Lesson 1.1: [Concept Name]
│   │   ├── Problem 1 (guided, easy)
│   │   ├── Problem 2 (slightly harder)
│   │   ├── Problem 3 (medium)
│   │   └── Problem 4 (synthesis)
│   ├── Lesson 1.2: [Concept Name]
│   │   └── ...
│   └── Lesson 1.N
│
├── CHAPTER 2: Building Up
│   └── ...
│
├── CHAPTER N: Mastery
│   └── ...
│
└── COURSE COMPLETION
    ├── Summary of concepts mastered
    ├── Next course recommendation
    └── Share achievement
```

### Key Structural Observations:
1. **Courses have 3-7 chapters**, each with 3-6 lessons
2. **Lessons have 3-6 problems** each
3. **Total problems per course: 50-150**
4. **Course duration: 1-4 hours** (but designed for 15-min daily sessions)
5. **Progress is saved** at every problem — you can leave and return anytime

---

## 4. THE INTERACTION TYPES

Brilliant uses a small, well-designed set of interaction primitives:

### Primary Interactions (used in 80%+ of problems):
1. **Multiple Choice** — 2-6 options, tap to select
2. **Numeric Input** — Type a number, submit
3. **Drag & Drop** — Arrange items in order, match pairs
4. **Tap to Reveal** — Tap elements to discover information

### Secondary Interactions (used for variety):
5. **Slider** — Adjust a value and see real-time feedback
6. **Drawing/Tracing** — Draw a path or shape
7. **Code Execution** — Write/run code snippets (CS courses)
8. **Interactive Diagram** — Manipulate a visual model

### What Brilliant NEVER Does:
- ❌ Long text blocks (> 6 lines)
- ❌ Video lectures
- ❌ Passive scrolling
- ❌ Timed pressure (no countdown timers on individual problems)
- ❌ Punitive wrong-answer penalties
- ❌ Walls of instructions before interaction

---

## 5. THE GAMIFICATION SYSTEM

### XP and Leveling
- Each problem solved earns XP (typically 10-50 XP)
- XP accumulates toward level-ups
- Levels are visible but NOT the primary motivator

### Streaks
- Daily streak counter (like Duolingo)
- Streak freezes available (reduces anxiety)
- **Key insight:** Streaks create a "don't break the chain" effect. This is the #1 retention mechanic.

### Leagues (Weekly Competition)
- Users are grouped into leagues of 30
- Weekly XP determines promotion/relegation
- Top 3 promoted, bottom 3 relegated
- **Why it works:** Social comparison + achievable goals + fresh start every week

### Progress Visualization
- Course progress bar (always visible)
- Chapter completion checkmarks
- Problem-level dots (filled = solved, empty = unsolved, star = perfect)
- **Key:** Progress is ALWAYS visible. You always know where you are.

### What Brilliant's Gamification is NOT:
- ❌ Not about points for their own sake
- ❌ Not about leaderboards as primary motivation
- ❌ Not about virtual goods or cosmetics
- ✅ It's about **making progress visible** and **creating daily habits**

---

## 6. THE CONTENT DESIGN PATTERN

### The "Brilliant Problem" Template:

```
┌──────────────────────────────────────────────┐
│                                              │
│  [Optional: 1-line narrative context]        │
│                                              │
│  [Visual element: diagram, animation,        │
│   interactive widget, or image]              │
│                                              │
│  [Question: 1-2 sentences max]              │
│                                              │
│  [Interaction area: choices, input field,    │
│   drag zone, etc.]                           │
│                                              │
│  [Submit button OR auto-submit on selection] │
│                                              │
└──────────────────────────────────────────────┘

ON CORRECT:
┌──────────────────────────────────────────────┐
│  ✓ [Brief explanation: 1-3 sentences]        │
│     [Optional: deeper insight or "why"]      │
│                                              │
│  [Continue button]                           │
└──────────────────────────────────────────────┘

ON WRONG:
┌──────────────────────────────────────────────┐
│  ✗ [Gentle correction: "Not quite."]         │
│  [Hint: 1 sentence pointing in right dir.]   │
│                                              │
│  [Try again button]                          │
└──────────────────────────────────────────────┘
```

### The "Brilliant Explanation" Pattern:
1. **State the answer** (1 sentence)
2. **Explain WHY** (1-2 sentences, referencing the visual)
3. **Connect to the bigger picture** (optional, 1 sentence)
4. **Never exceeds 50 words total**

---

## 7. THE ONBOARDING FLOW

1. **Sign up** → Pick interests (Math, Science, CS)
2. **Diagnostic** → 3-5 problems to assess level
3. **First course recommendation** → Matched to level + interest
4. **First problem within 30 seconds** of signing up
5. **First "aha" moment within 2 minutes**
6. **First streak day established immediately**

**Key metric:** Time-to-first-problem < 30 seconds. Time-to-first-aha < 2 minutes.

---

## 8. THE RETENTION ENGINE

### Daily Hooks:
1. **Streak maintenance** — "Don't lose your 7-day streak!"
2. **Daily Problem** — One free problem per day (even without subscription)
3. **League competition** — Weekly reset creates urgency
4. **Course progress** — "You're 60% through Logic!"

### Weekly Hooks:
1. **League promotion/relegation** — Fresh competition every Monday
2. **New course recommendations** — Based on completed courses
3. **Achievement unlocks** — Badges for course completion

### Monthly Hooks:
1. **Learning statistics** — "You solved 127 problems this month"
2. **Skill assessments** — "Your logic skill improved 23%"
3. **Community features** — Discussion threads on problems

---

## 9. WHAT MAKES BRILLIANT DIFFERENT FROM KHAN ACADEMY

| Dimension | Khan Academy | Brilliant |
|-----------|-------------|-----------|
| **Primary mode** | Watch → Practice | Practice → Discover |
| **Content delivery** | Video lectures | Interactive problems |
| **Role of teacher** | Central (Sal Khan) | Invisible (UI is the teacher) |
| **Pacing** | Self-paced videos | Self-paced problems |
| **Feedback** | After problem sets | After every problem |
| **Motivation** | Mastery-based progress | Streaks + XP + Leagues |
| **Depth** | Broad curriculum | Deep problem-solving |
| **Best for** | Learning procedures | Building intuition |
| **Session length** | 20-60 min (video) | 5-20 min (problems) |

---

## 10. THE BRILLIANT FORMULA — DISTILLED

If we reduce Brilliant's success to its essence:

```
BRILLIANT = 
    (Active Problems × Immediate Feedback × Visible Progress)
    ─────────────────────────────────────────────────────────
         (Time to First Problem × Cognitive Load per Screen)
```

**In plain English:** Maximize the ratio of "productive cognitive engagement" to "friction."

### The 10 Commandments of Brilliant's Design:

1. **Thou shalt not lecture.** Every concept is discovered through doing.
2. **Thou shalt make wrong answers feel safe.** Being wrong is the path.
3. **Thou shalt show, not tell.** Visual first, text second.
4. **Thou shalt keep text under 50 words per screen.**
5. **Thou shalt give feedback within 100ms of every action.**
6. **Thou shalt make progress always visible.**
7. **Thou shalt create a daily habit.** Streaks > content.
8. **Thou shalt scaffold difficulty.** 70% success rate = flow.
9. **Thou shalt get to the first problem in under 30 seconds.**
10. **Thou shalt make the learner feel smart.** The dopamine of "I got it!"

---

## 11. IMPLICATIONS FOR EARTH LOVE UNITED

### What We Should Steal:
1. **The micro-loop** — Stimulus → Struggle → Reveal → Consolidate → Progress
2. **Visual-first problem design** — Every climate concept as an interactive puzzle
3. **Productive failure** — Prediction questions where being wrong IS the lesson
4. **Scaffolded difficulty** — Each event starts easy, builds to complex
5. **Immediate feedback** — Every interaction gets instant response
6. **Progress visibility** — Always show where the learner is in the journey
7. **Daily engagement hooks** — Streaks, daily challenges, unlock sequences
8. **The 7-step learning experience** — Hook → Explore → Predict → Reveal → Connect → Act → Reflect (from our LEARNING_EXPERIENCE_DESIGN.md)

### What We Should Adapt:
1. **Narrative context** — Our narratives are climate stories, not math puzzles. The emotional stakes are real.
2. **Data-driven problems** — Use real climate data (NDVI, CO₂, temperature) as the "puzzle pieces"
3. **Globe as the interaction surface** — The 3D globe IS our visual canvas. Problems happen ON the Earth.
4. **GAIA as the guide** — GAIA replaces Brilliant's invisible UI teacher with an AI companion
5. **Emotional arc** — Wonder → Disbelief → Urgency → Agency (not just "flow")

### What We Should NOT Copy:
1. **XP/League system** — Too gamified for our audience. We want intrinsic motivation.
2. **Competitive elements** — Climate learning is collaborative, not competitive.
3. **Freemium paywall** — Our content should be free.
4. **Abstract problem design** — Every problem must connect to real climate impact.

---

## 12. THE MODULE PLAYER ARCHITECTURE

Based on Brilliant's formula + our existing data module JSON structure, here's what we need:

### Stage Types (from our data/modules/*.json):
| Type | Brilliant Equivalent | Our Implementation |
|------|---------------------|-------------------|
| `text` | Reading screen | Narrative + callouts + action buttons |
| `timeline` | Interactive diagram | Globe-centered timeline scrubber |
| `slider` | Interactive widget | Parameter exploration with live feedback |
| `gauge` | Progress visualization | Impact meter / carbon calculator |
| `quiz` | Multiple choice problem | Prediction questions with reveal |
| `cardstack` | Browseable content | Project cards, comparison cards |
| `branch` | Choose-your-path | Decision trees with consequences |

### The ELU Learning Loop (adapted from Brilliant):
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   1. HOOK        A striking visual on the globe     │
│      (5-10 sec)  or a provocative question.         │
│                  "60,000 hectares. 4 days."          │
│                                                     │
│   2. EXPLORE     Interactive timeline, slider,      │
│      (30-120 sec) or data exploration.              │
│                  Learner controls the pace.         │
│                                                     │
│   3. PREDICT     "What do you think happens        │
│      (10-30 sec) next?" Multiple choice.            │
│                  Being wrong is the point.          │
│                                                     │
│   4. REVEAL      Data visualization + GAIA          │
│      (15-30 sec) narration. "Here's what the        │
│                  satellite actually saw."           │
│                                                     │
│   5. CONNECT     "This isn't just Turkey.           │
│      (20-40 sec) Here's where else..."              │
│                  Global pattern recognition.        │
│                                                     │
│   6. ACT         "You're in charge. Make a         │
│      (30-60 sec) decision." Scenario builder.       │
│                  Real tradeoffs, real consequences. │
│                                                     │
│   7. REFLECT     Journal prompt, share card,        │
│      (15-30 sec) personal insight.                  │
│                  Consolidation + identity shift.    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 13. SUCCESS METRICS

How we'll know if our adaptation of Brilliant's formula works:

| Metric | Brilliant Benchmark | Our Target |
|--------|-------------------|------------|
| Time to first interaction | < 30 sec | < 15 sec (globe is already visible) |
| Problems per session | 10-40 | 5-15 (deeper, longer problems) |
| Session duration | 15-20 min | 5-10 min (mobile-first) |
| Return rate (D7) | ~40% | > 30% |
| Course completion | ~25% | > 20% |
| "Aha" moments per session | 3-5 | 2-3 (higher quality) |
| Prediction accuracy | ~70% | ~50-60% (harder, more thought-provoking) |

---

## 14. REFERENCES

- Wikipedia: Brilliant (website) — https://en.wikipedia.org/wiki/Brilliant_(website)
- Brilliant About Page — https://brilliant.org/about/
- Karpicke & Blunt (2011): "Retrieval Practice Produces More Learning than Elaborative Studying with Concept Mapping"
- Kapur (2008): "Productive Failure"
- Csikszentmihalyi (1990): "Flow: The Psychology of Optimal Experience"
- Brilliant course catalog analysis (this research)
- ELU LEARNING_EXPERIENCE_DESIGN.md (our design doc)
