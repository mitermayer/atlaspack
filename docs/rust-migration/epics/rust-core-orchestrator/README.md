# Rust Core Orchestrator — Start Here

Focus: request tracker, invalidation, graph orchestration. Build on Epic 0 utils.

## Key paths

- Tests: `packages/core/core/test/requestTracker.test.ts`, `.../invalidation.test.ts`, `.../graph-parity.test.ts`.
- Fixtures: `packages/core/core/test/__fixtures__/graph/`, `.../__fixtures__/request-smoke/`.
- Utils: reuse `packages/core/core/test/utils/normalize.ts`, `.../utils/artifacts.ts`.

## Commands

- Request/invalidation: `yarn test:js:unit --grep "request"`
- Graph parity: `yarn test:js:unit --grep "graph parity"`

## Definition of done

- Snapshots stable on JS; add/remove/rename/config-change cases covered.
- Graph serialization/parity tests present and passing on JS.
- Commands documented for integration CI; artifacts normalized.

## Before merge (checklist)
- [ ] Run Epic 0 baseline commands
- [ ] Run request/graph tests: `yarn test:js:unit --grep "request"` and `--grep "graph parity"`
- [ ] Verify snapshots in `packages/core/core/test/__fixtures__/graph/` and `.../request-smoke/`
- [ ] Confirm determinism (rerun, no snapshot changes)
