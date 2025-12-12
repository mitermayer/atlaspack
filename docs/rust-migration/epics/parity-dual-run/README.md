# Parity Baseline and Dual-Run — Start Here

Use Epic 0 utils/fixtures. CI wiring is integration-owned; you provide artifacts and commands.

## Key paths

- Harness/tests: `packages/examples/kitchen-sink/__tests__/` and `packages/core/core/test/parity/` (create if missing).
- Artifacts: `.parcel-cache/parity/<engine>/<fixture>/summary.json` (+ events JSONL).
- Utils: `packages/core/core/test/utils/normalize.ts`, `.../utils/artifacts.ts`.

## Commands

- Dual-run smoke (JS baseline): `yarn workspace @atlaspack/examples test --grep "dual-smoke"`
- Future dual-run full (once added): `yarn workspace @atlaspack/examples test --grep "dual"`

## Definition of done

- Smoke and main dual-run tests pass on JS; artifacts stable; tolerance rules documented.
- `summary.json` schema documented; commands for integration CI provided.

## Before merge (checklist)
- [ ] Run Epic 0 baseline commands (see Epic 0 README)
- [ ] Run dual-run smoke/full as applicable: `yarn workspace @atlaspack/examples test --grep "dual"`
- [ ] Verify artifacts under `.parcel-cache/parity/<engine>/<fixture>/summary.json` and normalization
- [ ] Confirm determinism (rerun, no unexpected diffs)
