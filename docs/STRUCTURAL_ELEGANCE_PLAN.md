# EARTH LOVE UNITED — STRUCTURAL ELEGANCE PLAN
## A Comprehensive Architecture Audit & Tiered Implementation Roadmap
### May 2026

---

## EXECUTIVE SUMMARY

The current codebase is a functional MVP with strong bones: a 3D globe, GAIA AI personality system, layered site panels, engagement scoring, and a pledge wall. It works. But it was built by multiple agents over weeks, and it shows — in the good way (diverse capabilities) and the challenging way (inconsistent patterns, duplicated data, missing abstractions).

This document does NOT propose rewriting what works. It identifies the gaps between our current implementation and a state-of-the-art system worthy of COP31, and provides a tiered plan to close them.

**Current state:** ~8,800 lines JS, ~2,400 lines CSS, 30 JS files, 13 CSS files, 2 HTML entry points, 1 DIS system (dis/), 1 knowledge engine, 4 data files.

**Target state:** A cohesive, performant, maintainable system that a team of developers can extend confidently, that loads in under 2 seconds, and that delivers an experience worthy of the climate crisis we're trying to communicate.

---

## PART 1: ARCHITECTURAL GAPS

### 1.1 Module System — The Foundation Problem

**Current:** 30 separate `<script>` tags loaded synchronously. Each module is an IIFE (`const X = (() => { ... })()`) that pollutes the global scope. Dependencies are managed by load order in index.html — a fragile, implicit contract.

**Gap:** No module system means:
- No tree-shaking (dead code ships)
- No lazy loading (everything loads upfront)
- No dependency graph (break load order, break the app)
- No namespacing (global scope pollution)
- No hot module replacement for development

**Target:** ES modules with a build step. Each file exports what it needs, imports what it depends on. The build step bundles, minifies, and tree-shakes.

### 1.2 Data Layer — Duplicated & Scattered

**Current:** Site/biome data exists in 3 places:
1. `data/sites.json` and `data/biomes.json` (loaded by `js/data.js`)
2. Hardcoded `_biomes` and `_sites` in `js/gaia-chat.js` (fallback)
3. `dis/climate-facts.json` (40+ hardcoded facts in `js/gaia-nodes.js`)

**Gap:** Data drift. The JSON files and hardcoded copies can diverge. No single source of truth. No data validation. No schema.

**Target:** Single JSON schema, validated at build time, loaded once, shared everywhere. TypeScript interfaces for type safety.

### 1.3 State Management — Implicit & Fragmented

**Current:** State is scattered across:
- `GAIA_ENGAGEMENT` (engagement score, mood, tiers)
- `GaiaState` (DIS state machine)
- `GAIA_JOURNAL` (journal entries, quests)
- `PLEDGE_WALL` (pledges)
- `GAIA_NODES` (per-site node states)
- `SITE_PANEL` (current site, current layer)
- `GLOBE_OVERLAY` (current site, current tab)
- `localStorage` (persisted state)

**Gap:** No unified state tree. No reactive updates. When engagement score changes, nothing automatically re-renders. Each module manages its own persistence. Cross-module communication is ad-hoc (custom events, direct calls).

**Target:** Centralized state store with reactive subscriptions. When state changes, dependent UI updates automatically.

### 1.4 Rendering — String Concatenation Everywhere

**Current:** Every render function builds HTML via template literals:
```javascript
container.innerHTML = `
  <div class="foo">
    ${data.map(item => `<span>${item.name}</span>`).join('')}
  </div>
`;
```

**Gap:** No component model. No virtual DOM. No diffing. Every state change re-renders entire subtrees. No event delegation — inline `onclick="..."` handlers throughout. Mixing HTML structure with JS logic makes both harder to maintain.

**Target:** Component-based rendering (lightweight — not React, but a consistent pattern). Event delegation. Separation of structure, style, and behavior.

### 1.5 CSS Architecture — Unscoped & Unmanaged

**Current:** 13 CSS files, ~2,400 lines, loaded globally. Class names like `.card`, `.section`, `.content` are generic and will collide. No CSS custom properties for theming (except a few `--teal`, `--warn`). No methodology (BEM, SMACSS, etc.).

**Gap:** Global namespace pollution. Specificity wars. No design tokens. No dark/light mode support. No responsive design system.

**Target:** CSS modules or scoped styles. Design tokens (colors, spacing, typography). Consistent naming convention. Responsive breakpoints as tokens.

### 1.6 Performance — Unoptimized

**Current:**
- 26 script tags = 26 HTTP requests (no bundling)
- 13 CSS files = 13 HTTP requests
- globe.gl loaded from CDN (481KB, no local fallback)
- No lazy loading — everything loads on page load
- No code splitting — gaia.html loads all DIS files even if user never uses them
- Inline styles in JS (e.g., `style="display:flex;align-items:center;gap:6px"`)
- No image optimization
- No service worker for offline support

**Gap:** First Contentful Paint is slow. Time to Interactive is slow. No offline capability. No performance budget.

**Target:** Bundled assets (< 5 requests total). Lazy-loaded routes. Service worker. Performance budget: < 2s FCP, < 3s TTI on 3G.

### 1.7 Accessibility — Absent

**Current:** No ARIA labels (except one on globe-overlay-close). No keyboard navigation support. No focus management. No screen reader testing. Color contrast not verified. No skip links. No reduced motion support.

**Gap:** The site is inaccessible to users with disabilities. This is both an ethical issue and a legal risk for COP31.

**Target:** WCAG 2.1 AA compliance. Keyboard navigable. Screen reader friendly. Focus management for overlays and modals.

### 1.8 Testing — None

**Current:** Zero tests. No unit tests, no integration tests, no E2E tests. Manual testing only.

**Gap:** Regressions are invisible. Refactoring is risky. No CI/CD safety net.

**Target:** Unit tests for core logic (engagement scoring, intent matching, carbon calculations). Integration tests for critical user flows. Visual regression tests for UI components.

### 1.9 Error Handling — Inconsistent

**Current:** Some modules have try/catch (Data.init, NDVI verifier), others don't. No global error handler. No error reporting. No user-friendly error messages (except the Data.init banner I just added).

**Gap:** Silent failures. Users see broken UI with no explanation. No way to report issues.

**Target:** Global error boundary. Consistent error handling pattern. User-friendly error messages. Error logging service integration.

### 1.10 Internationalization — Not Planned

**Current:** All text is hardcoded in English. No i18n framework. No RTL support.

**Gap:** COP31 is in Turkey. The site needs Turkish at minimum. Ideally multilingual.

**Target:** i18n framework. Translation files. RTL layout support. Language detection.

---

## PART 2: FEATURE GAPS

### 2.1 Globe Visualization — Underutilized

**Current:** Static markers for 4 sites. Points, labels, rings. No arcs, no heatmaps, no hex data beyond country outlines.

**Gap:** The globe.gl library supports 26+ visualization types. We're using 3. No animated arcs showing carbon flows. No heatmap of deforestation. No time-animated data. No custom shaders.

**Target:** Animated carbon credit flows (arcs). Deforestation heatmap overlay. Time-slider for historical data. Custom atmosphere shader. Site markers that pulse with engagement state.

### 2.2 GAIA Personality — Shallow

**Current:** 68 voice lines across 12 states. Engagement scoring with 5 tiers. Mood tracking with 13 emotions. Silence rules for 3 contexts.

**Gap:** Voice lines are selected randomly from pools — no contextual awareness beyond site+layer. No memory of what GAIA already said. No emotional arc across a session. No personality evolution over multiple visits. The DIS system (GaiaState, GaiaMind) is loaded but barely integrated with the main site.

**Target:** Context-aware line selection (not random). Cross-session emotional memory. Personality that evolves with engagement. DIS system fully integrated as the "brain" behind GAIA's responses.

### 2.3 Content — Static & Limited

**Current:** 4 project sites. 5 scroll sections. 16 quiz questions. ~2,800 knowledge chunks (in JSONL, not rendered).

**Gap:** Content is hardcoded in JSON files. No CMS. No way for non-developers to update content. Knowledge chunks are loaded but the synthesis tab is basic. No user-generated content beyond pledges.

**Target:** Headless CMS integration (or at minimum, a content pipeline). Dynamic content loading. User-contributed insights. Community features.

### 2.4 Data Visualization — Basic

**Current:** Canvas sparklines (hand-drawn). Static bar charts. No interactivity. No tooltips. No animations.

**Target:** Interactive charts with D3.js or Chart.js. Animated transitions. Drill-down capability. Export to image/PDF.

### 2.5 Mobile Experience — Untested

**Current:** Responsive CSS exists but the globe is heavy (481KB WebGL). Touch interactions not optimized. No mobile-specific UX. No PWA.

**Target:** Mobile-first responsive design. Touch-optimized globe controls. PWA with offline support. App-like experience.

### 2.6 Analytics — None

**Current:** No analytics. No tracking. No understanding of user behavior.

**Target:** Privacy-respecting analytics (Plausible or Fathom). Event tracking for key interactions. Funnel analysis for pledge conversion.

### 2.7 SEO — Nonexistent

**Current:** Single-page app with client-side rendering. No meta tags. No structured data. No sitemap. No Open Graph tags.

**Target:** Meta tags for all pages. Open Graph for social sharing. Structured data (Schema.org). Sitemap. Pre-rendering for crawlers.

---

## PART 3: TIERED IMPLEMENTATION PLAN

### TIER 1: Foundation (Week 1-2) — "Make it solid"

**Goal:** Fix the architectural foundation without changing the user-facing experience.

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 1.1 | Bundle scripts + CSS (Vite or esbuild) | -26 HTTP requests, -80% load time | Medium |
| 1.2 | Add error boundaries + global error handler | No silent failures | Low |
| 1.3 | Consolidate data layer (single source of truth) | No data drift | Medium |
| 1.4 | Add basic a11y (ARIA, keyboard nav, focus management) | WCAG baseline | Medium |
| 1.5 | Add meta tags, Open Graph, structured data | SEO baseline | Low |
| 1.6 | Add Plausible/Fathom analytics | User behavior visibility | Low |

**Deliverable:** Same experience, faster, more reliable, accessible, discoverable.

### TIER 2: Performance (Week 3-4) — "Make it fast"

**Goal:** Sub-2-second load time, smooth interactions.

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 2.1 | Lazy load DIS system (gaia.html only) | -300KB on main page | Low |
| 2.2 | Lazy load globe.gl (intersection observer) | Faster FCP | Medium |
| 2.3 | Add service worker + offline cache | Offline support | Medium |
| 2.4 | Optimize images, add WebP | -50% image weight | Low |
| 2.5 | Add loading states + skeleton screens | Perceived performance | Medium |
| 2.6 | Implement code splitting by route | Smaller initial bundle | Medium |

**Deliverable:** Lighthouse score > 90. Smooth 60fps globe. Offline-capable.

### TIER 3: Architecture (Week 5-6) — "Make it maintainable"

**Goal:** A codebase that a team can extend confidently.

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 3.1 | Migrate to ES modules | Proper dependency management | High |
| 3.2 | Add TypeScript interfaces for data | Type safety | Medium |
| 3.3 | Implement component pattern | Reusable UI | High |
| 3.4 | Centralized state management | Predictable state | High |
| 3.5 | CSS modules + design tokens | No style collisions | Medium |
| 3.6 | Add unit tests for core logic | Regression safety | Medium |

**Deliverable:** Modern, maintainable codebase. New features can be added without breaking existing ones.

### TIER 4: Experience (Week 7-8) — "Make it extraordinary"

**Goal:** An experience worthy of COP31.

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 4.1 | Animated carbon credit arcs on globe | Visual wow | Medium |
| 4.2 | Time-slider for historical globe data | Data storytelling | High |
| 4.3 | GAIA personality evolution across sessions | Emotional depth | High |
| 4.4 | Interactive D3.js charts | Data exploration | Medium |
| 4.5 | Mobile-optimized touch controls | Mobile UX | Medium |
| 4.6 | Turkish language support | COP31 readiness | Medium |
| 4.7 | Pledge Wall → backend integration | Real impact | High |
| 4.8 | Content pipeline for non-dev editors | Content velocity | Medium |

**Deliverable:** A world-class climate learning experience.

### TIER 5: Scale (Week 9-10) — "Make it production-ready"

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 5.1 | CI/CD pipeline (GitHub Actions) | Automated deploys | Medium |
| 5.2 | E2E tests (Playwright) | Regression safety | Medium |
| 5.3 | Visual regression tests (Percy) | UI stability | Medium |
| 5.4 | Performance monitoring (Web Vitals) | Ongoing optimization | Low |
| 5.5 | Error tracking (Sentry) | Production debugging | Low |
| 5.6 | CDN deployment (Cloudflare/Vercel) | Global performance | Low |
| 5.7 | Load testing | COP31 traffic readiness | Medium |

**Deliverable:** Production-grade deployment pipeline.

---

## PART 4: CRITICAL PATH FOR COP31

If COP31 is the deadline (November 2026), here's the critical path:

**Must have (Tier 1-2):** Bundle, error handling, a11y, SEO, performance. Without these, the site is unreliable and slow.

**Should have (Tier 3):** At minimum, the data layer consolidation and error boundaries. Full architecture migration can happen post-COP31.

**Nice to have (Tier 4):** Pick 2-3 high-impact items. I'd recommend: (1) GAIA personality evolution, (2) mobile optimization, (3) Turkish support.

**Can wait (Tier 5):** Full CI/CD, E2E tests — important but not blocking launch.

---

## PART 5: CODE QUALITY METRICS

### Current State (Estimated)
- **Bundle size:** ~630KB JS + 481KB globe.gl = ~1.1MB (uncompressed, unminified)
- **HTTP requests:** 26 scripts + 13 CSS + 1 CDN = 40 requests
- **Lighthouse performance:** ~40-50 (estimated)
- **Accessibility:** ~30 (estimated, no ARIA, no keyboard nav)
- **Test coverage:** 0%
- **Type safety:** 0%

### Target State (Post Tier 1-2)
- **Bundle size:** < 200KB (minified, gzipped, tree-shaken)
- **HTTP requests:** < 5 (bundled JS, bundled CSS, CDN globe.gl, fonts, data)
- **Lighthouse performance:** > 90
- **Accessibility:** > 80
- **Test coverage:** > 60% (core logic)
- **Type safety:** Data layer fully typed

---

## CONCLUSION

The current codebase is a remarkable achievement for a small team — it has a 3D globe, an AI personality system, engagement tracking, a knowledge engine, and a pledge wall. The gaps are not in ambition or features, but in engineering fundamentals: bundling, modularity, state management, accessibility, and testing.

The tiered plan above is designed to be executed incrementally. Each tier delivers standalone value. You can stop after Tier 1 and have a solid, reliable site. You can continue to Tier 4 and have a world-class experience. The key is to not skip foundations — Tier 1 makes everything else easier.

**Immediate next step:** Commit the current fixes, then start Tier 1.1 (bundling). That single change will have the biggest immediate impact on performance and developer experience.
