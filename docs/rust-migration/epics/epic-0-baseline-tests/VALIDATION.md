# Validation Playbook — Epic 0 Baseline Tests

Use this to quickly validate the Epic 0 (JS baseline) work and ensure the harness/tests are deterministic and usable by integration.

## Commands (run in this order)
1) Baseline utils (core):
   ```
   yarn test:js:unit --grep "baseline utils"
   ```
2) Dual-run smoke (examples, JS engine):
   ```
   yarn workspace @atlaspack/examples test --grep "dual-smoke"
   ```
3) Request/invalidation smoke (core):
   ```
   yarn test:js:unit --grep "request smoke"
   ```

## Expected artifacts
- Dual-run smoke: `.parcel-cache/parity/js/dual-smoke/summary.json` (and optional `events.jsonl`).
- Request/invalidation: `packages/core/core/test/__fixtures__/request-smoke/graph.json`.

## `summary.json` contract (dual-run smoke)
- Required fields: `fixture` (string), `engine` ("js"), `bundles` (array of {name, hash}), `graphs` (array of {kind, nodes, edges}), `diagnostics` (array), `timings` (object with numeric fields).
- Normalization: paths are relative/workspace-style, no absolute host paths; hashes stable across runs.

## Determinism check
- Rerun the three commands twice; no changes to `summary.json` or `graph.json` beyond timestamps (which should already be stripped).
- Git status should remain clean after runs (other than cache/parcel artifacts ignored by git).

## Pass/fail criteria
- All commands exit 0.
- Artifacts exist at the paths above and include required fields.
- Snapshots/goldens unchanged on rerun; no unexpected files under `__fixtures__`.

## Known exclusions
- Rust engine is not exercised here; this is JS baseline only.
- Only smoke fixtures are covered; broader fixture sets land in later epics.

## If something fails
- Check normalization utils (`packages/core/core/test/utils/normalize.ts`) are applied.
- Verify fixture paths match the commands above.
- Ensure native builds aren’t required for these JS-only tests.
