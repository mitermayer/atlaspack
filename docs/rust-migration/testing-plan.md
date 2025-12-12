# Testing and Parity Baseline Plan (JS-first, Integration CI-owned)

## Purpose

Provide a JS-engine baseline test strategy per migration epic so integration-owned CI can run/enforce parity while the bundler supplies runnable tests, fixtures, and artifacts.

## Principles

- JS engine is the source of truth: new tests must pass under `ATLASPACK_ENGINE=js` and record goldens/snapshots from JS outputs.
- Parity is measured by diffing Rust outputs to JS goldens via dual-run harness; harness and artifacts live here, CI wiring is external.
- Tests favor determinism: seeded randomness, stable paths, minimal fixtures, no clock/time dependence.

## Epic→Test Types

- Core orchestrator/cache/request tracker: JS unit + integration parity on graphs/invalidations; Rust unit/nextest. Golden graph snapshots.
- Pipeline scheduler/bundler/scope-hoist/tree-shake/packager: integration bundle/graph goldens; stage-order checks; manifest/hash parity.
- Transformers (JS/CSS/HTML/SVG/Image/JSON/YAML/raw/tokens): fixture-driven unit/contract tests per package; integration bundle goldens.
- Resolver/RPC: unit protocol/shape tests; contract for request/response; parity on resolved graphs.
- Watch/HMR: record/replay watch traces; scripted HMR transcripts; incremental invalidation targets.
- Cache/schema: schema-version tests; hash-parity matrix runner outputs; safe migrate/invalidate behavior.
- CLI/Reporter: integration smoke; reporter output contracts (logs/diagnostics formatting).
- Observability/Perf: JSON/JSONL metrics/perf export shape tests; benchmark harness (smoke/full) with documented budgets.
- Rollout/Flags: flag precedence/error messaging tests; dual-run entry behavior; fallback messaging.
- Plugin parity: per-plugin goldens (inputs → outputs/diagnostics/metadata); contract tests; audit checklist for JS-only plugins.

## Locations (suggested)

- JS unit: `packages/**/src/__tests__` or `packages/**/test`
- JS integration/parity: `packages/integration-tests/**`, `packages/examples/**` goldens, `packages/core/integration-tests/parity`
- Rust unit/nextest: `crates/<crate>/**` (unit + integration)
- Cross-language harness artifacts: `.parcel-cache/parity/<engine>/<fixture>/summary.json` (+ JSONL events)

## How to run (baseline)

- JS unit: `yarn test:js:unit --grep "<area>"` or `yarn workspace @atlaspack/<pkg> test`
- JS integration/parity: `ATLASPACK_ENGINE=js yarn test:integration --grep "<epic>"`
- Rust unit: `cargo nextest run -p <crate>` (or `cargo test`)
- Dual-run (manual/local): `ATLASPACK_ENGINE=dual yarn test:integration --grep "<epic>"` produces parity artifacts/diffs.

## Progress Metrics

- Coverage by epic: % epics with (a) JS unit and (b) integration/parity tests landed.
- Fixture/golden coverage: # fixtures per epic with fresh JS goldens; last refresh date.
- Parity signal: pass/fail counts from dual-run diff (integration CI reports); time-to-detect regressions.
- Determinism: flake rate of parity tests; seeded/normalized outputs.

## Baseline Rules

- New/updated goldens must be produced by JS engine and reviewed.
- Dual-run must exit non-zero on diffs; `summary.json` schema is stable and documented alongside harness.
- Budgets/tolerances documented next to fixtures/tests; changes require review.

## Hand-off to Integration CI

- Provide runnable test commands and harness; do not add CI jobs here.
- Expose machine-readable fixture catalog, tolerance rules, and `summary.json` schema for ingestion.
- Ensure artifacts and logs live at predictable paths for collection.
