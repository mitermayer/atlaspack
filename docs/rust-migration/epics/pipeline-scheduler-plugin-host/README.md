# Pipeline Scheduler & Plugin Host — Start Here

Use Epic 0 utils; focus on stage ordering, plugin lifecycle, and contracts. Integration CI consumes commands; you provide tests/artifacts.

## Key paths

- Tests: `packages/core/core/test/pluginPipeline.test.ts`, `.../integration/plugin-pipeline.test.ts`.
- Fixtures/goldens: `packages/core/core/test/__fixtures__/plugin-pipeline/`.
- Utils: `packages/core/core/test/utils/normalize.ts`, `.../utils/artifacts.ts`.

## Commands

- Pipeline hooks/order: `yarn test:js:unit --grep "plugin pipeline"`

## Definition of done

- Hook ordering/concurrency tests passing on JS; artifacts/logs normalized.
- Commands documented for integration CI; stage timing outputs (JSON/JSONL) optional but stable.

## Before merge (checklist)

- [ ] Run Epic 0 baseline commands
- [ ] Run pipeline hook/order tests: `yarn test:js:unit --grep "plugin pipeline"`
- [ ] Verify artifacts/logs in `packages/core/core/test/__fixtures__/plugin-pipeline/`
- [ ] Confirm determinism (rerun, no unexpected diffs)
