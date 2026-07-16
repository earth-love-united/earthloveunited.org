# CT-14 Top-20 Primary-Source Evidence Gap Queue

**Snapshot:** 2026-07-15
**Status:** deterministic research queue; not reviewed; not release eligible

## Purpose

This queue turns the reviewed 2023 factual emissions ranking into a bounded
primary-source research backlog. It does not claim that a country has or lacks
a target, does not assess performance, and does not add facts to the runtime.

The exact ranked universe is China, United States, India, Russia, Indonesia,
Brazil, Japan, Iran, Saudi Arabia, Canada, Mexico, South Korea, Germany,
Australia, Türkiye, South Africa, Vietnam, Pakistan, Thailand, and Nigeria.

## Required evidence per entity

Each entity has three explicit document requirements:

1. latest official Party inventory submission with scope and methodology;
2. latest active NDC and official UNFCCC registry metadata;
3. official target text and methodology sufficient to reproduce baseline,
   coverage, conditionality, and accounting treatment.

The queue records the Party authority and UNFCCC secretariat as source owners,
and routes each document role to the pending CT-01 UNFCCC source families. It
does not change those pending source decisions.

## Current coverage

- 20 ranked entities are listed.
- China, India, Indonesia, and Iran have committed CT-11 metadata-only audits.
- China, India, and Indonesia have active-NDC metadata in CT-11.
- Iran has legacy INDC metadata only; the queue does not convert it into an NDC.
- Sixteen entities have no committed CT-11 primary-source audit.
- No top-20 entity has a committed reviewed official inventory in this stack.
- No entity is eligible for commitment, target, delivery, performance, or score claims.

For each entity, the artifact separates missing and withheld fields across
scope, base year/baseline, coverage, conditionality, and methodology. All gaps
carry canonical fail-closed reason codes.

## Boundaries

No browsing or document acquisition was performed for CT-14. The queue uses
only the pinned reviewed factual runtime candidate, the existing CT-11 audit,
and the CT-01 source registry. It contains no copied Party text, normalized
target values, new source approvals, or production runtime facts.

## Deterministic checks

```sh
node tools/build-top20-primary-source-gap-queue.js --check
node tools/check-top20-primary-source-gap-queue.js
node tools/climate-truth-ci.js --allow-incomplete
```

The checker rebuilds the artifact byte-for-byte, verifies the exact ranking
and input pins, rejects non-canonical reasons and prohibited claim fields,
confirms the queue is absent from runtime loaders, and rejects adversarial
release, ranking, provenance, field, scoring, and hash mutations.
