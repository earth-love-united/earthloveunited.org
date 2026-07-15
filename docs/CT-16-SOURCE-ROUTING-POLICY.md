# CT-16 Versioned Source-Routing Policy

**Snapshot:** 2026-07-15

**Routing model:** 2.0.0

**Status:** blocked governance contract; no rights or release authority

## Purpose

CT-14 correctly records a fail-closed acquisition backlog, but its flat
`acceptable_source_registry_ids` array cannot distinguish a primary value
source from a conditional component or corroborating review evidence. CT-16
adds that distinction without editing the immutable CT-14 or CT-15 snapshots.

The new policy and successor queue are offline publication controls. They are
not loaded by the site and do not add country facts.

## Inventory routing

| Source family | Explicit role | Current state | Can satisfy primary values now? |
|---|---|---|---|
| UNFCCC NIR/CRT | Primary inventory value source | Pending rights, exact document checksums, governance, and independent review | No |
| UNFCCC BTR/CTF | Conditional primary component | Blocked because the registry lacks the `official_inventory` domain and no exact component has been approved | No |
| UNFCCC TER | Corroboration and conflict evidence only | Normalized findings remain pending | Never by itself |

BTR cannot be authorized at the family level. A future route requires an
explicit CTF table, inventory chapter, or national inventory document; exact
bytes and checksum; reviewed `official_inventory` domain governance; a rights
decision; and independent review. Adding a registry domain alone is not enough.

TER may corroborate or qualify Party evidence. It cannot replace a Party
submission or supply the sole value-bearing inventory record.

## NDC and target routing

The NDC Registry remains limited to active-NDC identity and target-methodology
documents. It is explicitly prohibited from satisfying the official-inventory
role. A failed download does not establish that a target is absent.

## Preserved boundaries

- CT-14 and CT-15 remain byte-identical inputs.
- The source registry and every source approval remain unchanged.
- No rights, normalized-value, scoring, CT-40, runtime, or release decision is
  created.
- All 20 successor queue entries remain unreviewed and release-ineligible.
- Production runtime manifest, reviewed release diff, and CT-40 allow manifest
  remain absent.

## Human decisions still required

1. Decide whether specifically identified BTR inventory/CTF components should
   receive the `official_inventory` domain after source-governance review.
2. Record document-specific redistribution and scoring rights; do not infer
   them from public access.
3. Approve the role model before any successor acquisition package can count a
   primary inventory route as satisfied.

## Verification

```sh
node tools/build-source-routing-policy.js --check
node tools/check-source-routing-policy.js
node tools/check-climate-source-registry.js
node tools/check-top20-primary-source-gap-queue.js
node tools/check-climate-evidence-licensing-readiness.js
```

The CT-16 checker validates both JSON schemas, rebuilds both artifacts
byte-for-byte, pins CT-14/CT-15/source-registry checksums, proves the artifacts
are absent from runtime loaders, and rejects role, domain, rights, scoring,
runtime, and release mutations after recalculating their hashes.
`tools/climate-truth-ci.js` treats CT-16 as a required component.
