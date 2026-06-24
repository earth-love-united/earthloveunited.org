# Workstream 05 — Accessibility and Responsive Behavior

## Outcome

Both experiences work at 320–390 px widths, 200% zoom, keyboard-only input, and common assistive-technology interaction patterns.

## Current evidence

- `gaia.html` overflows horizontally at a 390 px viewport (observed document width about 653 px).
- Both pages disable user zoom with `user-scalable=no`.
- Quiz answers, biome/scenario controls, GAIA suggestions, and hint chips use clickable non-semantic elements.
- Several labels are very small or low contrast; heading and accessible-name structure is incomplete.

## Packets

### A11Y-001 — Restore zoom

- `HIGH` · `D1 Easy` · `EXECUTE`
- Remove zoom prevention from both viewport declarations.

### A11Y-200 — Semantic controls and focus behavior

- `HIGH` · `D2 Moderate` · `EXECUTE`
- Replace interactive `div`/`span` elements with buttons, links, inputs, or correct composite widgets. Preserve visible focus, disabled state, names, and Enter/Space behavior.
- Acceptance: core journeys complete without a pointer and focus never enters hidden/off-screen panels.

### A11Y-201 — Mobile overflow and sizing

- `HIGH` · `D2 Moderate` · `EXECUTE`
- Identify the elements forcing GAIA’s layout wider than the viewport; correct constraints without hiding content. Raise essential text and target sizes to an agreed accessible floor.
- Run `StackLint.audit()` after CSS changes.

### A11Y-300 — Accessibility release gate

- `HIGH` · `D3 Hard` · `DESIGN`
- Define automated and manual checks: landmarks/headings, names/roles/states, keyboard flows, focus order, modal focus containment, reduced motion, contrast, zoom, overflow, and screen-reader announcements.

## Verification matrix

- Pages: `index.html`, `gaia.html`.
- Widths: 320, 390, 768, 1280 px.
- Modes: default, 200% zoom, keyboard-only, reduced motion, high contrast where available.
- Journeys: navigate globe modes, open/close panels, answer quiz, use GAIA suggestions, reset state.

