# Country Climate Visual Truth Contract

**Status:** Proposed Gate 0 visual baseline; runtime implementation prohibited until science/data sign-off

**Contract version:** 0.1.0

**Methodology dependency:** `docs/COUNTRY-CLIMATE-METHODOLOGY.md` version 0.1.0

**Golden fixtures:** `data/climate/fixtures/visual-truth.json`

## Purpose

This contract defines how the Living Globe must present country climate
evidence without allowing missing, weak, or non-comparable commitments to make
a high emitter look favorable. It is a design and acceptance contract, not a
runtime design patch. `js/globe.js`, `css/globe-system.css`, and `index.html`
remain unchanged in this mission.

The interface must answer separate questions:

1. **Impact:** how consequential is the emissions footprint?
2. **Target integrity:** is a commitment documented and comparable?
3. **Ambition:** how adequate is an eligible commitment against named
   benchmarks?
4. **Delivery:** are observed emissions and policies moving at the required
   pace?
5. **Fair contribution:** what responsibility, capability, and support context
   is available?
6. **Evidence:** how strong, current, and internally consistent is the record?

These dimensions must never collapse into a single color or an opaque public
score. Impact is context, not virtue. Evidence quality is confidence, not
performance.

## Normative language

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. A runtime release fails
this contract if any `MUST` assertion fails a golden fixture.

## Visual grammar

### Persistent impact channel

Absolute annual territorial emissions are the persistent accountability cue.
When compatible harmonized economy-wide GHG evidence is available:

- polygon or fallback-marker height MUST use the approved versioned log scale;
- the default face treatment MUST use a labelled sequential magnitude scale;
- the latest observation year, unit, scope, and eligible universe MUST be
  available in the legend and country label;
- switching lenses MUST NOT reduce or replace the height cue;
- target, ambition, delivery, evidence, finance, or project data MUST NOT alter
  impact height; and
- a high-impact entity with a missing or non-comparable target MUST retain the
  same height as it has in the Emissions lens.

The future implementation must publish scale thresholds with the profile data.
Until thresholds are approved, fixtures use semantic bands (`very_high`,
`high`, `medium`, `low`, `not_assessed`) rather than invented numeric cutoffs.

If compatible emissions evidence is unavailable, the entity remains present
at the geographic minimum height with a visible `Impact not assessed` marker.
This is an unknown state, not a low-impact band. Low opacity MUST NOT encode
missing evidence.

### Separate channels

| Dimension | Map channel | Card treatment | Forbidden conflation |
|---|---|---|---|
| Impact | Persistent height; sequential face in default/Emissions lens | Magnitude, year, scope, share | Never red/green virtue |
| Target integrity | Shape/icon and explicit text | Target anatomy and reason codes | Never inferred from delivery |
| Ambition | Ambition-lens categorical face plus named benchmark | Separate benchmark rows | Never called progress |
| Delivery | Perimeter/status marker plus text when eligible | Pace and projection tests kept separate | Never inferred from gap sign alone |
| Fair contribution | Card context only in v1 | Responsibility/capability/support facts | Never offsets domestic delivery |
| Evidence | Persistent grade/flag glyph; Evidence-lens pattern | Grade, reasons, conflicts, lineage | Never changes performance hue |

Color is supplementary. Every categorical treatment MUST have a text label and
a non-color cue such as an icon, line style, pattern, or shape. No unknown state
may use the positive-delivery checkmark or solid positive outline.

### Delivery color reservation

Green is reserved for a comparable delivery result of `ahead` or `on_pace`
that passes the methodology's evidence gate. It MUST NOT represent:

- low emissions;
- a target's mere existence;
- missing independent assessment;
- a negative level gap without a valid pace test;
- climate projects or credit purchases; or
- reporting flexibility.

`uncertain` receives an uncertainty symbol and neutral treatment.
`not_assessed` receives an open-circle/unknown symbol and explicit reason.

## Status vocabulary

Public UI copy MUST use these labels or an approved plain-language expansion.
Stored values are shown in code style.

### Impact

| Value | Public label |
|---|---|
| `very_high` | Very high impact |
| `high` | High impact |
| `medium` | Medium impact |
| `low` | Low impact |
| `not_assessed` | Impact not assessed |

### Target integrity

| Value | Public label |
|---|---|
| `comparable` | Target comparable |
| `partially_comparable` | Target partly comparable |
| `non_comparable` | Target not comparable |
| `qualitative_or_sectoral` | Qualitative or sectoral target |
| `no_active_target_found` | No documented active target |
| `not_assessed` | Target not assessed |

`No target` is prohibited because it conflates absence with missing or
incompatible calculation inputs.

### Ambition

`Aligned`, `Almost sufficient`, `Insufficient`, `Highly insufficient`,
`Critically insufficient`, and `Ambition not assessed` are the only headline
labels. Every assessed result MUST name its benchmark. Domestic-pathway,
fair-share, and independent-source results remain separate rows.

### Delivery

| Value | Public label | Required non-color cue |
|---|---|---|
| `ahead` | Ahead of required pace | double chevron |
| `on_pace` | On pace | checkmark |
| `uncertain` | Pace uncertain | uncertainty diamond |
| `off_course` | Off course | warning triangle |
| `not_assessed` | Progress not assessed | open circle |

The phrase `On track` is prohibited: the delivery result is a bounded
comparison of recent observed pace or a named policy projection, not a
prediction of target achievement.

### Evidence

Evidence is labelled `Evidence A`, `Evidence B`, `Evidence C`, or `Evidence D`
with reason text. Flags use the methodology vocabulary, including
`conflicting`, `stale`, `not_reviewed`, `reporting_optional`, and
`source_unavailable`. `reporting_optional` MUST be described as reporting
context and MUST NOT lower a performance result.

### Headline syntax

The compact headline follows this order:

```text
{Impact} · {Target integrity or ambition} · {Delivery} · Evidence {grade}
```

An ambition or delivery phrase is omitted or explicitly `not assessed` when it
does not pass its gate. The UI MUST NOT synthesize an overall good/bad label.

## Map lenses

All lenses retain the persistent impact height and an accessible textual list.
Changing lenses changes the question, not the underlying country order or
emissions geometry.

### Accountability (default)

- Face: sequential absolute-emissions magnitude.
- Height: absolute-emissions magnitude.
- Perimeter/status marker: delivery result when eligible, otherwise target or
  evidence-state symbol with text.
- Persistent evidence glyph: grade plus conflict/staleness marker.
- Default legend: magnitude scale first, then delivery/evidence symbols.

This lens prevents the current neutral-color loophole: a major emitter remains
large and visually forceful even if progress cannot be assessed.

### Emissions

- Face and height: absolute annual emissions using the same approved scale as
  Accountability.
- Optional selector: economy-wide GHG, fossil CO2, or LULUCF, never silently
  combined.
- Legend and ranking update together and state year, scope, plane, and unit.

### Target adequacy

- Face: categorical ambition only where the named benchmark covers the entity.
- Non-assessed entities: neutral patterned face plus explicit symbol; never
  pale green.
- Target-integrity icon remains separate from ambition.
- Height remains impact.

### Progress

- Perimeter and center symbol: `ahead`, `on_pace`, `uncertain`, `off_course`,
  or `not_assessed`.
- A level-gap indicator MAY be shown as a second symbol but MUST be labelled
  `current level versus target`, never merged with pace.
- Height remains impact.

### Evidence

- Face: ordered evidence-grade treatment with letter glyph.
- Patterns/icons distinguish `conflicting`, `stale`, `not_reviewed`, and
  `reporting_optional`.
- A material official/harmonized disagreement uses a split-plane conflict
  symbol and opens both values; it is never averaged.
- Height remains impact where impact evidence is available.

## Ranking contract

### Default ranking

The default rail is **Largest annual emitters**. Eligibility requires a value
from the selected common accounting frame, plane, period, and unit. The header
MUST declare:

```text
{eligible_count} of {mapped_count} mapped entities ranked
{metric} · {year/period} · {plane} · {unit}
```

Rows are sorted descending by unrounded value. Displayed ties share a rank and
the next rank follows competition ranking (`1, 2, 2, 4`). Every row includes
the emissions value and observation year. The ranking MUST NOT be reordered by
target availability, ambition, delivery, CAT coverage, projects, or evidence
grade.

Entities without eligible emissions evidence appear in a separate unnumbered
`Not ranked — evidence unavailable or incompatible` group. They MUST NOT be
alphabetically appended to numbered ranks.

### Optional pledge-overshoot ranking

Eligibility requires a comparable target and a scope-matched latest
observation/target level. The rail MUST disclose both:

- `{eligible_count} comparable entities`; and
- `{eligible_count} of {mapped_count} mapped entities eligible`.

The metric, target case (conditional or unconditional), scope, year, and unit
must be visible. Non-comparable and missing cases are unnumbered and state the
reason. A negative or positive level gap does not determine the separate pace
status.

### Optional rankings

Any per-capita, cumulative, ambition, delivery, or finance ranking requires its
own eligibility rule and denominator. A control MUST NOT preserve ordinals
from a previous lens after the eligible universe changes.

## Country card information architecture

The card has a stable reading order. Sections may collapse visually, but their
headings and state summaries remain in the accessibility tree.

1. **Identity and headline**
   - entity name and identity qualifiers;
   - multi-axis headline, never a composite score;
   - observation/release date and evidence-grade shortcut.
2. **Responsibility and impact**
   - latest emissions, year, scope, plane, unit, and global share;
   - fossil CO2, economy-wide GHG, and LULUCF as separate rows;
   - per-capita and cumulative context only with matched denominators and
     explicit years.
3. **Commitment and target integrity**
   - native target type/text, target/reference years, gases, sectors, LULUCF,
     conditionality, Article 6 treatment, and source;
   - normalized endpoint only when comparable;
   - non-comparability reasons beside the target, not hidden in Evidence.
4. **Ambition**
   - progression, domestic pathway, fair-share range, and licensed independent
     assessment as separate benchmark rows;
   - uncovered benchmarks say `not assessed`.
5. **Delivery and observed chart**
   - recent observed pace versus required pace;
   - current-policy projection versus target as a separate test;
   - current level versus target as a separate fact;
   - uncertainty and scope match visible beside every result.
6. **Fair contribution**
   - responsibility, capability, and international support context;
   - provided, mobilized, needed, and received finance remain distinct;
   - no finance row changes the domestic-delivery status.
7. **Evidence and methods**
   - official and harmonized planes, source title/version/date/locator;
   - grade reasons, conflicts, missing fields, uncertainty, review state;
   - methodology version and data release ID.
8. **Projects and markets — outside the profile**
   - rendered after a strong divider or in a separate drawer;
   - headed `Projects and markets`;
   - always states `Not part of the national climate performance profile`;
   - project count, claimed reductions, credits, or purchases MUST NOT change
     map status, headline, rank, impact, ambition, delivery, or evidence grade.

Marketing calls to action MUST NOT interrupt sections 1–7 or appear inside a
performance-colored container.

## Observed-chart contract

### Permitted marks

- Observed annual values: solid point markers at real years.
- Connection between consecutive compatible observations: solid line.
- Official and harmonized series: separately styled and directly labelled.
- Reported uncertainty: bounded band or interval whisker.
- Comparable conditional/unconditional target endpoints: distinct endpoint
  marks.
- Illustrative required pathway: dashed line explicitly labelled
  `Illustrative required pathway`.
- Independent current-policy projection: separately styled projection band,
  named and sourced.

### Hard rules

- No modeled, interpolated, projected, or proxy value may be drawn as an
  observed point.
- A line MUST break across incompatible scope/method changes or missing annual
  values; the chart MUST NOT visually imply an observation.
- Delivery assessment requires at least six compatible observations, even if a
  shorter series is displayed.
- A required pathway appears only for a comparable target and begins at the
  actual latest compatible observation.
- BAU and intensity targets receive no absolute endpoint unless their required
  baseline/denominator evidence passes comparability.
- A source conflict displays both series or withholds the affected result; it
  never averages the values.
- Axes show real years, units, scope, and zero handling. Truncated axes are
  explicitly indicated.
- `Today` is prohibited unless it is truly the observation date. Use `Latest
  observation · {year}`.
- Display precision cannot exceed source precision.

Every chart has an SVG `<title>` and `<desc>`, a visible legend, a textual
summary, and an accessible data table or equivalent disclosure. The summary
states series name, period, direction, uncertainty, target endpoint if any,
and why a delivery result is or is not available.

## Official and harmonized evidence

The two evidence planes answer different questions and must be visibly named.
When both are present:

- the card defaults to the harmonized series for cross-country ranking and
  preserves the official series alongside it;
- the UI states the source, latest year, scope, and method for each;
- a material conflict adds `Evidence conflict` to the headline evidence area;
- derived metrics identify the plane used; and
- users can inspect both values without changing the published record.

No toggle may imply that one plane is the hidden corrected version of the
other.

## Reporting flexibility and country context

`reporting_optional`, `not_yet_due`, SIDS, LDC, territory, and UNFCCC Party
flags are evidence context. They MUST NOT be styled as failure or included in
ambition/delivery arithmetic. A reporting-optional entity remains visible and
may be ranked on compatible harmonized emissions evidence, but receives no
delivery status without the required evidence.

## Interaction and accessibility

### Keyboard

- Every lens, rail row, country marker proxy, card control, section disclosure,
  chart-data disclosure, and source link is reachable in a logical order.
- The globe canvas has an adjacent keyboard-operable country list/search; a
  pointer-only polygon is insufficient.
- Opening a country card moves focus to its heading or dialog/region container.
- `Escape` closes the card and restores focus to the invoking row/control.
- Arrow keys MAY browse countries only when the card is focused and the
  behavior is announced; they MUST NOT hijack page or card scrolling.
- Touch/swipe is an enhancement. Previous/next buttons remain available and
  have at least 44 by 44 CSS-pixel targets.
- Focus indicators meet 3:1 contrast and are never removed without replacement.

### Screen readers

- The active lens and eligibility denominator are announced on change through
  a polite live region.
- A country label reads impact first, then target integrity, ambition,
  delivery, and evidence; it never announces color.
- Map decorative meshes are hidden from the accessibility tree; the equivalent
  list carries semantics.
- Status icons have hidden decorative glyphs and adjacent visible text.
- Loading, data error, and empty states use concise status messages without
  repeated announcements.

### Responsive and zoomed layouts

- At 320 CSS pixels and at 400% browser zoom, no country fact or control is
  clipped or requires two-dimensional scrolling.
- The rail becomes a labelled drawer/list, not an unexplained strip of codes.
- The card uses one column; chart data and source links remain reachable.
- Sticky controls do not cover card content or the browser focus target.
- Long country names, source titles, units, and reason codes wrap without
  truncating their accessible name.
- Hover-only content is also available on focus and activation.

### Contrast, color, and motion

- Normal text meets WCAG AA 4.5:1; large text meets 3:1.
- Meaningful chart lines, polygon boundaries, icons, focus rings, and controls
  meet 3:1 against adjacent colors.
- Status pairs are distinguishable in light and dark themes and in grayscale.
- Every status combines color with text and a non-color cue.
- `prefers-reduced-motion: reduce` removes globe/card entrance, swipe, and
  transition animation without removing state changes.
- Auto-rotation pauses on focus, hover, card open, and reduced-motion
  preference.

## Golden fixtures

`data/climate/fixtures/visual-truth.json` contains fictional entities and
expected semantic presentation. Fixture IDs describe evidence patterns, not
real countries. The minimum corpus is:

1. `high-impact-target-non-comparable`
2. `high-impact-intensity-target`
3. `positive-level-gap-on-pace`
4. `comparable-off-course`
5. `reporting-optional-sids`
6. `official-harmonized-conflict`
7. `fully-missing-evidence`
8. `high-impact-no-documented-target`

Fixtures define semantic outputs rather than final colors or pixel values so
later theme work cannot weaken the truth assertions. Real-country facts enter
only after CT-10/CT-11 review.

## Runtime test assertions

CT-30 through CT-33 and CT-41 MUST make the following executable in both the
polygon and fallback-marker rendering paths:

1. Impact height is identical for an entity across all lenses.
2. High impact remains high when target, ambition, or delivery is unavailable.
3. Missing/non-comparable evidence never yields a positive hue, checkmark,
   positive label, or lowered impact prominence.
4. Delivery status depends on delivery eligibility, not the sign of a level
   gap.
5. A positive level gap with `on_pace` shows both facts without contradiction.
6. Intensity/BAU targets without denominators/baselines draw no absolute target
   endpoint or required path.
7. Official/harmonized conflict displays both planes and no reconciled value.
8. Default rank is emissions-only; ineligible rows have no ordinal.
9. Overshoot rank declares eligible and mapped denominators.
10. Projects cannot mutate any profile axis, rank, map encoding, or headline.
11. Every chart point traces to an observed fact and a real year.
12. Every chart has title, description, textual summary, and accessible data.
13. Status remains understandable with CSS color removed.
14. Keyboard selection, close/focus return, list navigation, and lens switching
    pass without canvas pointer input.
15. Light/dark contrast, reduced motion, 320px width, and 400% zoom checks pass.
16. Public copy uses this vocabulary and never calls modeled values measured.

## Release, rollback, and failure behavior

The runtime switch MUST be controlled by a versioned profile-artifact pointer
or equivalent reversible release boundary. A release records previous and new
artifact IDs, methodology version, contract version, checksum, and public-copy
version.

Rollback MUST restore the complete previous set together:

- profile artifact;
- visual-contract-compatible runtime module/version;
- legend and public copy;
- service-worker/cache version; and
- release manifest.

Partial rollback is prohibited because old labels applied to new semantics (or
the reverse) can create false claims. If the profile artifact fails validation
or cannot load, the globe MUST fail closed to geographic presence plus
`Country climate profile unavailable`; it MUST NOT fall back to legacy
`No target`, `Overshooting`, or `On track` classifications.

Release evidence includes fixture-validator output, deterministic profile
checks, browser screenshots for every golden case in light/dark and narrow
layouts, keyboard transcript, screen-reader semantics audit, contrast report,
SmokeTest, StackLint, and independent science/data sign-off.

## Gate for runtime work

This contract may guide prototypes, but production visualization work starts
only after CT-01 source/licence semantics and CT-02 evidence schema reconcile
their enums and identifiers with these fixtures. Any disagreement is resolved
in the contracts—not through permissive runtime fallback.
