# Workstream 03 — GAIA Security and Privacy

## Outcome

GAIA treats all remote/model content as untrusted, keeps credentials out of logs and unsafe browser storage, and explains data handling before a user sends content.

## Current evidence

- Model content can reach `innerHTML` in `js/gaia-chat.js` without a demonstrated sanitizer or constrained schema.
- CSP currently permits inline script/style behavior, reducing its value as an XSS backstop.
- A user-supplied API key is stored in `sessionStorage`, its prefix is logged, and requests are made directly from the browser.
- No sufficiently clear privacy disclosure precedes model submission.

## Packets

### SEC-001 — Remove credential logging

- `HIGH` · `D1 Easy` · `EXECUTE`
- Remove key fragments and credential-derived identifiers from logs and error UI.
- Acceptance: repository search and browser console inspection reveal no key material.

### SEC-002 — Contain unsafe rendering

- `BLOCKER` · `D2 Moderate` · `DESIGN`
- Until SEC-200 lands, render remote content as text or allow only a minimal reviewed formatting path.
- Acceptance: HTML/script payloads display inertly and cannot create DOM nodes or event handlers.

### SEC-100 — Threat model and data-flow decision

- `BLOCKER` · `D3 Hard` · `STUDY`
- Document assets, trust boundaries, attacker capabilities, prompt/model output handling, conversation retention, credential storage, third-party transmission, CSP constraints, and offline behavior.
- Decide between a server-side proxy with scoped credentials, user-provided ephemeral credentials, or disabling remote GAIA in production.
- Required approval: security/architecture owner and product owner.

### SEC-200 — Structured output renderer

- `BLOCKER` · `D3 Hard` · `DESIGN`; depends on SEC-100.
- Prefer a small response schema (text, citations, optional known action IDs) and construct DOM nodes with `textContent`. Do not accept arbitrary model HTML.
- Acceptance: an adversarial payload corpus cannot execute script, inject attributes, navigate, or alter surrounding UI.

### SEC-201 — Approved credential and privacy boundary

- `BLOCKER` · `D3 Hard` · `DESIGN`; depends on SEC-100.
- Implement the selected architecture, consent copy, retention behavior, deletion/reset behavior, and failure states.

## Verification gates

- Add XSS payload tests for tags, attributes, URLs, entities, markdown links, and malformed structured output.
- Verify keys/tokens never appear in console, DOM, URL, analytics, persistent storage, or error reports.
- Validate production CSP and response headers at the deployed origin, not only in HTML meta tags.

