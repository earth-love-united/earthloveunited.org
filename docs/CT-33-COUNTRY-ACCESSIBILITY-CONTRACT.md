# CT-33 Country Accessibility Contract

Status: deterministic accessibility payload and static contract checker. Live
DOM, browser, screen-reader, CSS, and globe integration are deliberately
deferred.

## Scope

`tools/lib/country-accessibility-model.js` compiles an implementation contract
for the country globe proxy, ranking rail, country dialog, evidence chart, and
source trail. It validates CT-30, CT-31, and CT-32 artifacts when callers supply
them and fails closed on unsafe semantics.

This work implements the semantic and structural parts of the CT-03 visual
truth contract. It does not claim that a future rendered page passes WCAG based
on JSON alone.

## Contract domains

### Keyboard and focus

- Every lens/list/card/chart/source control has a logical `tab_index: 0` order.
- Every interactive target is at least 44 by 44 CSS pixels.
- A keyboard-operable country search/list is the semantic proxy for the globe.
- Opening the country card focuses its dialog/heading.
- `Escape` closes the modal dialog and focus returns to the exact invoking
  ranking row or control.
- Focus remains trapped while the modal dialog is open.
- Arrow-key country browsing is dialog-scoped, announced, and cannot hijack
  page scrolling.
- Focus indicators are explicitly retained; their computed contrast remains a
  browser verification gate.

### Status without color

Every status requires visible text, a semantic color token, and a separate
shape/icon/pattern/line cue. Decorative glyphs are hidden from assistive
technology because adjacent text carries the meaning. Unknown, unassessed,
uncertain, withheld, and unavailable states cannot use a positive tone,
checkmark, or double chevron.

The checker also inspects CT-30 target, delivery, and evidence markers. A
`not assessed` label with a positive tone fails even if the marker omitted an
explicit state.

### Chart

The CT-32 accessible chart payload becomes an SVG contract with:

- `role="img"`;
- linked title and description IDs;
- a textual summary;
- a keyboard-reachable data disclosure and table caption; and
- a generated label for every observed point containing series, evidence
  plane, real year, numeric value, unit, uncertainty, and fact ID.

Missing years, units, values, fact IDs, titles, descriptions, or summaries fail
the compiler. Scenario and required-path separation remains enforced by CT-32.

### Ranking announcements

The CT-31 ranking announcement always states:

```text
{eligible_count} of {mapped_count} mapped entities ranked
{metric}, {year or period}, {plane}, {unit}
```

Each ranked row announces its ordinal and eligible denominator. The unranked
group remains unnumbered and announces its count and evidence reasons.
Denominator or period inconsistencies fail closed.

### Reflow, zoom, motion, and contrast

The payload requires a one-column 320 CSS-pixel layout, no two-dimensional
scrolling, wrapped long text, and no sticky-control overlap. At 200% zoom,
content and the chart-data disclosure remain reachable without clipping or
two-dimensional scrolling.

Reduced-motion mode removes transitions and globe/card/swipe entrances while
preserving state changes. Auto-rotation pauses for reduced motion, focus, and
an open country card.

CT-33 records contrast requirements through token pairs rather than assigning
colors:

- normal text: at least 4.5:1;
- large text: at least 3:1;
- focus rings, meaningful graphics, and controls: at least 3:1.

`final_css_values_assigned` must remain false until design tokens and rendered
light/dark surfaces can be measured.

### DOM safety contract

Interactive controls cannot be children of `#globeViz`. Decorative globe
meshes are hidden from the accessibility tree. Hidden, offscreen, or fully
transparent elements must use `pointer-events: none`, preventing invisible
click interception.

### Evidence and projects

Evidence sources require descriptive accessible names, HTTPS links, keyboard
focus, and 44-pixel focus targets. Heading levels cannot skip downward.

Projects and markets retain the exact accessible disclaimer:

```text
Not part of the national climate performance profile
```

and `affects_profile: false`. Missing or changed disclaimer text fails.

## Verification

Run:

```bash
node tools/check-country-accessibility.js
node tools/check-country-view-model.js
node tools/check-country-card-evidence-model.js
```

The CT-33 corpus contains one deterministic full-stack payload and eighteen
expected failures covering color-only state, chart labels, units/years,
positive unknown state, project disclaimer, target size, focus restoration,
heading order, dialog escape, globe nesting, invisible pointer interception,
zoom, motion, source links, ranking denominator/period, chart summary, and
contrast tokens. The checker also verifies that every local JSON Schema `$ref`
resolves before validating output.

## Browser work still required

After runtime integration, release evidence must include:

1. a complete keyboard transcript for search, ranking, dialog, disclosures,
   close, and focus restoration;
2. screen-reader checks for dialog naming, SVG title/description, point/table
   labels, live-region rank changes, and unranked announcements;
3. measured contrast reports for light/dark themes and grayscale distinction;
4. screenshots and interaction checks at 320 CSS pixels and 200% zoom;
5. computed reduced-motion and auto-rotation behavior;
6. `StackLint.audit()` for stacking, hidden-pointer, and offscreen safety;
7. both polygon and fallback-marker globe paths; and
8. verification that removing CSS color leaves every status understandable.

Static CT-33 success is a prerequisite for those tests, not a substitute for
them.
