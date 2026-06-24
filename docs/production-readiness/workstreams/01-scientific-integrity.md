# Workstream 01 — Scientific Integrity

## Outcome

Every public climate figure and educational answer is internally consistent, traceable to an approved source, explicit about units/baselines/uncertainty, and reviewed on a defined cadence.

## Current evidence

- The site presents `143 Gt CO2/year` emitted and `123 Gt CO2/year` absorbed as if they form a net-emissions equation. This appears to mix gross natural fluxes with anthropogenic emissions.
- The remaining 1.5°C budget is presented as `250 Gt` and about six years; the value is time-sensitive and no review date is visible.
- A 2025 temperature value is shown without a consistently stated baseline.
- Quiz reforestation answers do not match the repository’s own carbon model. One item multiplies a stock difference by 30 years, producing a stock/flow dimensional error.

Likely surfaces include `js/carbon-clock.js`, `js/quiz.js`, `gaia.html`, `dis/climate-facts.json`, `js/gaia-chat.js`, `js/gaia-voice.js`, `js/cycle.js`, and `js/gaia-legacy/gaia-data.js`.

## Packets

### SCI-001 — Contain disputed claims

- `BLOCKER` · `D1 Easy` · `DESIGN`
- Present the product owner with the affected surfaces and the reversible choices: hide the value/feature or retain it behind a clearly visible “under scientific review” treatment. Record the selected treatment, then apply it without inventing replacement figures.
- Acceptance: no disputed number is presented as settled fact; containment is visually clear and reversible.

### SCI-100 — Approve the claims methodology

- `BLOCKER` · `D3 Hard` · `STUDY`
- Produce a decision record covering authoritative sources, cutoff date, temperature baseline, carbon-budget probability, treatment of natural gross fluxes, uncertainty display, and reviewer/update cadence.
- Required reviewers: climate-domain reviewer and product owner.
- Stop condition: do not bulk-replace numbers until the methodology is approved.

### SCI-200 — Correct public claims

- `BLOCKER` · `D2 Moderate` · `EXECUTE`; depends on SCI-100.
- Inventory every duplicate of each approved claim, replace it consistently, and add source/date metadata.
- Acceptance: repository search finds no stale variants; displayed units and baselines are explicit.

### SCI-201 — Repair educational calculations

- `BLOCKER` · `D2 Moderate` · `EXECUTE`; depends on SCI-100.
- Define whether each question asks for stored carbon or annual sequestration, calculate from one model, and rewrite answer choices/explanations.
- Acceptance: independently recomputed answers match the keyed answer within a documented tolerance.

### SCI-300 — Versioned facts registry

- `HIGH` · `D4 Program` · `DESIGN`; depends on SCI-200/201.
- Create one data source with `id`, value, unit, baseline, uncertainty, source URL, source date, reviewed date, reviewer, and status. Make clock, quiz, GAIA, and narrative surfaces consume it.
- Architectural note: preserve bare-metal loading; no bundler or ES modules.

## Verification gates

- Add dimensional-invariant tests for stocks versus flows and CO2 versus carbon.
- Search all HTML/JS/JSON surfaces for retired figures.
- Run `node --check` on changed JavaScript and the repository’s existing data/load-order validators.
- Browser-check both pages at desktop and mobile widths with network unavailable.
