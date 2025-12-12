# Ticket: Request/Invalidation Smoke Test (JS Baseline)

## Objective

Add a small request/invalidation parity test that exercises add/change/delete flows and snapshots the request graph on JS engine.

## Tasks

- Create a small fixture under `packages/core/core/test/__fixtures__/request-smoke/` with a root file importing a dep.
- Add test `packages/core/core/test/request-smoke.test.ts` that builds with JS engine, snapshots the request graph JSON (normalized), then mutates the fixture (edit dep, delete dep, restore) and asserts invalidation/rebuild set matches expectations.
- Store snapshots under `packages/core/core/test/__fixtures__/request-smoke/graph.json` (normalized ids/paths).
- Document command/path for integration CI: `yarn test:js:unit --grep "request smoke"`.

## Acceptance Criteria

- Test passes on JS engine; snapshots stable across runs.
- Invalidation targets match expected set for edit/delete/restore.
- Uses shared normalization utils; exits non-zero on failure.
