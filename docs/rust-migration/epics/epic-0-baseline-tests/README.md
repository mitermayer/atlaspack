# Epic 0: JS Baseline Tests — Quick Start

Purpose: seed shared normalization/utils and first JS-baseline smoke tests so all later epics can reuse fixtures and artifact layouts.

## Where to work

- Normalization utils: `packages/core/core/test/utils/normalize.ts` (create if missing).
- Artifact writer helper: `packages/core/core/test/utils/artifacts.ts` (create if missing).
- Dual-run smoke test: `packages/examples/kitchen-sink/__fixtures__/dual-smoke/` (fixture) and `packages/examples/kitchen-sink/__tests__/dual-smoke.test.ts`.
- Request/invalidation smoke test: `packages/core/core/test/__fixtures__/request-smoke/` and `packages/core/core/test/request-smoke.test.ts`.

## Commands

- JS unit (core tests): `yarn test:js:unit --grep "baseline utils"`
- Dual-run smoke (examples): `yarn workspace @atlaspack/examples test --grep "dual-smoke"`
- Request/invalidation smoke: `yarn test:js:unit --grep "request smoke"`

## Expected outputs

- Parity artifacts: `.parcel-cache/parity/js/dual-smoke/summary.json` (+ optional events JSONL), normalized with utils.
- Request graph snapshot: `packages/core/core/test/__fixtures__/request-smoke/graph.json` (normalized ids/paths).

## Definition of done

- Utils exist and are used by both smoke tests; README in utils folder documents normalization functions.
- Dual-run smoke passes on JS engine; artifacts written to predictable path with stable schema.
- Request/invalidation smoke passes on JS; snapshot stable across runs; invalidation sets as expected.
- Commands above documented and exit non-zero on failure.

## Before merge (checklist)

- [x] Run baseline utils: `yarn test:js:unit --grep "baseline utils"`
- [x] Run dual-smoke: `yarn workspace @atlaspack/examples test --grep "dual-smoke"`
- [x] Run request-smoke: `yarn test:js:unit --grep "request smoke"`
- [x] Verify artifacts: `.parcel-cache/parity/js/dual-smoke/summary.json`, `packages/core/core/test/__fixtures__/request-smoke/graph.json`
- [x] Confirm determinism (rerun, no snapshot changes)

## Stubs provided (implement these, do not recreate)

- Utils: `packages/core/core/test/utils/normalize.ts` (suggested API: normalizePaths, stripTimestamps, stableSortKeys)
- Utils: `packages/core/core/test/utils/artifacts.ts` (suggested API: writeSummary, writeEvents; use normalize helpers)
- Fixtures: `packages/examples/kitchen-sink/__fixtures__/dual-smoke/` (add tiny JS+CSS with one dynamic import)
- Fixtures: `packages/core/core/test/__fixtures__/request-smoke/` (add root + dep files for add/edit/delete scenarios)
