# Ticket: Dual-Run Smoke Test (JS Baseline)

## Objective

Add a minimal dual-run smoke test that runs a tiny fixture with JS engine only (for now) and writes parity artifacts in the documented layout.

## Tasks

- Create a tiny fixture (e.g., `packages/examples/kitchen-sink/__fixtures__/dual-smoke/`) with simple JS+CSS and one dynamic import.
- Add test (e.g., `packages/examples/kitchen-sink/__tests__/dual-smoke.test.ts`) that runs JS engine, writes artifacts to `.parcel-cache/parity/js/dual-smoke/summary.json`, and asserts basic bundle/graph presence and no diagnostics.
- Use normalization utils for paths/timestamps; ensure test passes on JS engine.
- Document command/path for integration CI: `yarn workspace @atlaspack/examples test --grep "dual-smoke"`.

## Acceptance Criteria

- Test passes on JS engine; artifacts written to predictable path with stable `summary.json` schema.
- Uses shared normalization utils; no flakiness across runs.
- Command is documented and exits non-zero on failure.
