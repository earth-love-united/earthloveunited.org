# TRU-100: Commitments, Public Wall, Moderation & Donation Product Decision

## Status: DECISION-READY (awaiting human approval)

## Date: 2026-06-24

## Scope

This decision record covers:
1. Public commitment/wall feature (user-submitted climate pledges)
2. Moderation model for user-generated content
3. Donation integration architecture
4. Trust & safety boundaries for the education-first site

## Current State (from code audit)

### Existing Trust/Safety Components
- **Key Gate** (`dis/gaia-key-gate.js`): gates LLM API access behind user-provided key
- **Quest System** (`dis/gaia-quest-system.js`): tracks user progress through educational tasks
- **Engagement Score** (`gaia-engagement.js`): tracks user activity tier (COLD → WARM → HOT)
- **Pledge Wall** (historical module, absent from the current runtime): does not load or display the retired country payload
  - NO user submission capability
  - NO moderation queue
  - NO server-side storage
- **Gaia Journal** (`js/gaia-journal.ts`): personal reflection/diary — stored client-side only
- **Welcome-back system**: session info stored via `GAIA_DATA.saveSessionInfo()`

### Current "Trust Layer" Architecture
```
User ←→ GAIA Chat (client-side) ←→ OpenRouter (with key gate)
     ←→ Live APIs (NOAA, Carbonmark) ←→ Static fallback data
     ←→ Living Globe (country evidence withheld pending a reviewed runtime release)
```

No user-generated content currently stored or displayed from other users.

## Decision Surface

### Commitment/Public Wall Options

#### Option A: No Public Wall (Current State)
- Keep pledge wall as curated display of country/institutional pledges only
- No user submissions
- Zero moderation cost
- Pros: No trust/safety risk, zero maintenance
- Cons: Users cannot participate publicly, only read

#### Option B: Verified Email-Gated Submissions
- Users submit a commitment via form + email verification
- Moderation queue: human reviews before publication
- Display: anonymous or display-name only (no PII)
- Pros: Barrier to spam, accountability via email, curated quality
- Cons: Email collection introduces PII, moderation workload, blocks anonymous participation

#### Option C: Pseudonymous + Community Moderation
- Submit with optional email (for recovery)
- Community flagging + automated toxicity filter (client-side or lightweight function)
- Auto-publish unless flagged
- Pros: Low barrier, community self-governance
- Cons: Requires moderation tooling, potential for spam/toxicity

#### Option D: Source-Bound Commitments Only
- Users can "pledge" only by connecting to an external verified source
  (e.g., submit a GitHub repo, pull request, project ID from carbon registry)
- Pros: Grounded in real action, self-verifying
- Cons: High barrier to entry, excludes casual participants

### Donation Integration Options

#### Option 1: Mailto Only (Current)
- Volunteer/Partner CTAs link to `mailto:hello@earthloveunited.org`
- No payment processing on-site
- Pros: Zero compliance burden, no PCI-DSS scope
- Cons: No tracking, no recurring donations, friction to convert

#### Option 2: External Payment Link
- Link to Stripe/Donorbox/Gumroad hosted page (e.g., `donate.earthloveunited.org`)
- Donation happens on their infrastructure, not ours
- Pros: PCI scope handled by vendor, recurring donations possible, analytics available
- Cons: Redirects away from site, vendor fees (typically 3-5%)

#### Option 3: Embedded Stripe Elements
- Stripe.js loaded on page, payment form embedded
- Card data never touches our server (Stripe handles PCI scope)
- Pros: Seamless UX, subscription/recurring support
- Cons: Requires backend webhook endpoint (breaks bare-metal principle), SaaS dependency

#### Option 4: Crypto / On-Chain Option
- Accept USDC/ETH via wallet connect
- Transparent, aligns with carbon market proximity
- Pros: Novelty, public audit trail
- Cons: Volatility, UX complexity, tax complexity

### Moderation Architecture (if public wall is enabled)

**Option M1: Pre-Moderation (Human Review Queue)**
- All submissions enter queue, human approves before publish
- Implemented via simple admin panel or even GitHub Issues/PRs
- Implementation: submission → webhook → repo issue → manual approve → script deploys
- Pros: Highest quality, full human control
- Cons: Slow (hours to days), requires ongoing human time

**Option M2: Post-Moderation (Publish First, Flag/Remove)**
- Auto-publish submissions meeting automated criteria (no blocked words, rate limit)
- Community flagging triggers removal
- Automated: profanity filter + rate limiting + submission length constraints
- Pros: Near-instant, low moderation cost
- Cons: Bad content visible until caught, requires monitoring

**Option M3: Hybrid (Auto-Moderated + Human Escalation)**
- Auto-publish clean submissions
- Flag borderline for human review
- Ban-list + hash-based duplicate prevention
- Pros: Balances speed and safety
- Cons: Most complex to implement

## Trust Principles (Proposed)

1. **Education first**: Public wall content must advance understanding, not just express opinion
2. **No PII displayed**: Display names only — no email, no real name unless explicitly public
3. **No financial guidance on moderation queue**: Donations never affect moderation decisions
4. **Bare-metal default**: Prefer client-side/static solutions; server components only when strictly necessary
5. **COP31 deadline aware**: Any public wall must be ready by November 2026 — simplicity wins

## Feasibility vs COP31 Deadline (November 2026)

| Feature | Effort | Dependencies | Viable by Nov? |
|--------|--------|-------------|----------------|
| External donation link | 1h | Stripe/Donorbox account | YES |
| Mailto refinement | 2h | None | YES |
| Public wall (Option A keep) | 0h |
| Public wall (Option B email-gated) | 2-3 days | Email service, moderation UI | Tight |
| Public wall (Option C pseudonymous) | 3-5 days | Moderation tooling | Risky |
| Stripe embedded | 1-2 days | Stripe account | Breaks bare-metal |

## Decision-Ready Questions for Human Approval

Q1: **Public wall** — keep educational display only (A) or enable user submissions (B/C/D)?
Q2: **Commitment identity model** — email-gated, pseudonymous, or source-bound?
Q3: **Donation path** — external link (2) vs. embedded Stripe (3) vs. mailto only (1)?
Q4: **Moderation model** (if wall enabled) — pre-moderation (M1) vs post (M2) vs hybrid (M3)?
Q5: **PII boundary** — are we comfortable collecting email for commitment verification?

## Dependencies
- SEC-100 decision (threat model scope) gates TRU-100 final scope
- SEC-100 Q3 (user-submitted content decision) directly affects this DR
- PR #2 may affect pledge-wall.js — re-eval after merge

## Files Reviewed
- `js/pledge-wall.js` — pledge wall display code
- `js/gaia-engagement.js` — engagement scoring
- `js/gaia-journal.ts` — personal journal client-side storage
- `index.html` (lines 753-779) — Volunteer/Partner CTAs
- `dis/gaia-key-gate.js` — credential gating
