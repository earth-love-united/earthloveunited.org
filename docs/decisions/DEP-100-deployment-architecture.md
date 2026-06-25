# DEP-100: Deployment Architecture Decision

## Status: DECISION-READY (awaiting human approval)

## Date: 2026-06-24

## Scope

Deployment architecture for earthloveunited.org given:
- Bare-metal JS codebase (no build step, no bundler, no npm)
- Static hosting (currently served via `serve.py` on port 8080)
- Service worker for offline caching
- CDN dependencies (cdn.jsdelivr.net, unpkg.com, fonts.googleapis.com)
- No backend, no API server, no database
- Phase A cleanup done, Phase B/C prunes pending

## Current State

### Current "Deployment"
```bash
cd <repo-root>
python3 serve.py        # port 8080, NoCacheHandler
```
- Single `serve.py` with aggressive no-cache headers for development
- No staging environment
- No CI/CD pipeline
- No deployment automation
- Manual: copy files to host
- SSL: depends on host
- CDN/runtime deps: globe.gl, fonts, image textures loaded from jsdelivr/unpkg at page load

### Asset Inventory
- HTML: 2 files (index.html, gaia.html)
- CSS: 18 files (15 loaded, 3 dead)
- JS: 53 files (47 loaded, 6 dead)
- Data: 17 JSON/CSV files + 8 module JSONs
- Textures: 50 binary tiles (NDVI, gitignored)
- DIS: 7 runtime files + climate-facts.json
- Build artifacts in dist/ (gitignored)

### CSP Constraints (from index.html)
```
script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com
connect-src 'self' https://gml.noaa.gov https://api.carbonmark.com ...
-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com https://*.tile.openstreetmap.org
```

## Decision Surface: Deployment Target

### Option A: GitHub Pages (Free, Simplest)
- Push to `gh-pages` branch, GitHub handles SSL + CDN
- Custom domain: `earthloveunited.org` → CNAME to `orgname.github.io`
- Pros: Free, auto SSL, built-in CDN, zero maintenance
- Cons: No server-side headers control, 100MB repo limit, no build hooks, no redirects config beyond `_redirects`
- CSP: Cannot add CSP headers via GitHub Pages (no `.htaccess`, no server config)
- Tiles: `textures/ndvi/` must stay out of repo (already gitignored — fine)

**Verdict:** Viable if CSP control is not required. Acceptable loss for a static education site.

### Option B: Netlify (Static Hosting + Functions)
- Drag-and-drop deploy or git-hook
- Add `_redirects` / `netlify.toml` for headers, CSP, CORS
- Pros: Free tier sufficient, custom headers, deploy previews, form handling (potential future moderation queue)
- Cons: Vendor lock-in (config in their format), another dependency, build hooks limited
- Could add Netlify Functions for lightweight backend (donation webhook, moderation submission)

**Verdict:** Strong option if SEC-100/TRU-100 decisions require any server-side component.

### Option C: Vercel (Edge Functions)
- Git-hook deploy, edge runtime
- Pros: Fast global CDN, server-side functions, analytics
- Cons: Similar vendor lock-in, edge functions have execution limits, cost scales with traffic
- Overkill for current scale

**Verdict:** Only if TRU-100 requires server-side moderation + need guaranteed low-latency globally.

### Option D: AWS S3 + CloudFront
- Static website hosting on S3 bucket, CloudFront distribution
- Pros: Full control, Scalable, custom domain SSL via ACM, S3 lifecycle rules for tiles/textures
- Cons: Cost (~$1-5/mo for low traffic, more at scale), more complex setup, IAM management add Lambda@Edge for headers/form processing

**Verdict:** Premium option, only justified if traffic exceeds 10K monthly or compliance requires AWS.

### Option E: Bare Metal/VPS (Current setup extended)
- Deploy via `scp rsync` to a VPS, nginx as reverse proxy
- Pros: Full control, can run serve.py or nginx, cheapest at scale for dedicated resources
- Cons: SSL cert management, server maintenance, monitoring needed, no auto CDN

**Verdict:** Only if the team wants to operate infrastructure themselves.

## Deployment Architecture Decision Options

Given the bare-metal JS principle and current team size:

### Architecture Alpha: Static-Only (Pages or Netlify)
```
GitHub → GitHub Pages / Netlify → CDN → User Browser
                              � Service Worker (offline cache)
                              ↘ Live APIs (NOAA, Carbonmark — side loaded, not server)
```
- Zero server runtime
- No backend functions
- CSP via meta tags (already in place) or `_headers` (Netlify)
- Deploy command: `git push` or `netlify deploy --prod`

### Architecture Beta: Static + Functions (Netlify)
```
GitHub → Netlify Deploy
            ├─ Static assets (HTML/CSS/JS) → CDN
            ├─ Netlify Functions (API)      → Donation webhook
            │                                Commitment submission (form → webhook → queue)
            └─ Redirects/headers             → netlify.toml
```
- Static-first, server functions only where strictly needed
- Form handling for future public-wall submissions
- Donation: Stripe Checkout hosted on Stripe, webhook to Netlify Function to confirm

### Architecture Gamma: Static + Manual Tooling
```
Developer
  ├─ npm run deploy:rs (or git push to Pages)
  ├─ scripts/deploy.sh     (automated file sync)
  └─ scripts/invalidate.sh (CDN cache purge if needed)
Server: nginx or serve.py
S3: optional asset bucket for NDVI tiles (large binaries)
```

## Service Worker Considerations

Current `sw.js` precaches static assets for offline use.
- With GitHub Pages: SW scope limited to the deployed origin — works fine
- With CDN dependencies: globe.gl / fonts / tiles loaded from jsdelivr/unpkg — SW must handle cross-origin caching carefully
- PR #2 may change asset structure — re-evaluate after merge

## Build Pipeline Decision

Given "bare-metal, no build step" principle:

| Step | Current | Recommended |
|------|---------|-------------|
| None | ✅ | Keep it — maintain bare-metal principle |
| CSS bundle | Multiple CSS files, load order critical | Single `style.css` with CSS modules concatenated (low-cost win) |
| JS lint | None | Add `node --check` on all staged JS in pre-commit hook |
| Data validation | `scripts/` Python validators | Keep + run manually before deploy |
| Deploy | Manual | `git push` (Pages) or `rsync` script |

### CSS Bundling (Recommended Low-Cost Win)
- Current: 15 separate CSS files loaded via `<link>` (rendering-blocked)
- Recommendation: Use `css/build.js` (referenced in SKILL.md) to concatenate modules into `style.css`
- Pros: Fewer HTTP requests, faster first paint
- Cons: Requires `node css/build.js` to regenerate — but this is a one-person step, not a build system
- Aligns with bare-metal principle: pre-bake at "deploy time" rather than runtime bundling

## Security Headers (Deployment Layer)

Regardless of host, these should be set:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

GitHub Pages: Cannot set these (no server config). CSP via `<meta>` tag only.
Netlify: Can set via `_headers` file.
S3+CloudFront: Can set via S3 metadata / CloudFront behaviors.

## Decision-Ready Questions for Human Approval

Q1: **Hosting target** — GitHub Pages (A), Netlify (B), or VPS/S3 (D/E)?
Q2: **Server functions needed** — does SEC-100/TRU-100 require any backend? (If yes → Netlify; if no → Pages)
Q3: **CSS bundling** — adopt `css/build.js` concatenation for production? (Recommended yes)
Q4: **Deploy automation** — git-hook (push to deploy) or manual script?
Q5: **NDVI tiles hosting** — keep gitignored + manual deploy, or move to S3 bucket?

## Dependencies
- SEC-100 must be approved first (this DR explicitly gated)
- TRU-100 determines if server functions are needed
- PR #2 may affect asset structure — re-eval after merge

## Files Reviewed
- `index.html` (lines 855-944) — script load order, SW registration
- `serve.py` — current dev server
- `sw.js` — service worker (not read in full, structure confirmed)
- `css/` directory — 18 files, 15 loaded
- `AGENTS.md` — architecture constraints
