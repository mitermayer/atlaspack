# Observability & Performance — Start Here

Emit metrics/perf data as JSON/JSONL; integration CI ingests.

## Key paths

- Tests: `packages/core/core/test/telemetry.test.ts`, `.../perf-counters.test.ts`.
- Fixtures: `packages/core/core/test/__fixtures__/telemetry/trace.json`, `.../perf/counters.json`.
- Utils: `packages/core/core/test/utils/normalize.ts`, `.../utils/artifacts.ts`.

## Commands

- Telemetry: `yarn test:js:unit --grep "telemetry"`
- Perf counters: `yarn test:js:unit --grep "perf"`

## Definition of done

- Spans/counters emitted and normalized on JS; schemas documented.
- Outputs written to predictable paths; commands provided for integration CI.

## Before merge (checklist)

- [ ] Run Epic 0 baseline commands
- [ ] Run telemetry/perf tests: `yarn test:js:unit --grep "telemetry"` and `--grep "perf"`
- [ ] Verify outputs in `packages/core/core/test/__fixtures__/telemetry/trace.json` and `.../perf/counters.json`
- [ ] Confirm determinism and schema stability (rerun, no unexpected changes)
