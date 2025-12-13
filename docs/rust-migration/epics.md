# Epics and Stories

Details: see per-epic folders under `docs/rust-migration/epics/<epic>/` (indexed in `docs/rust-migration/index.md`). CI/dual-run wiring and alerting are handled by integration; this project provides flags, artifacts, schemas, and docs for them to consume. Start with Epic 0 (baseline tests) below.

## Epic 0: JS Baseline Test Scaffolding

- [x] Story: Create shared normalization/utils and first smoke tests (dual-run, request/invalidation) on JS engine with stable artifacts. See `docs/rust-migration/epics/epic-0-baseline-tests/`.

## Epic: Parity Baseline and Dual-Run Harness

- [x] Story: Add CLI/env flags (`--engine=rust|js|dual`) with validation; acceptance: flags documented, dual-run executable locally and in CI.
- [x] Story: Dual-run harness producing bundle/graph/hash/diag diffs with tolerance rules; acceptance: diff artifacts stored, red/green criteria defined.
- [x] Story: Fixture suite covering scope hoisting, HMR/watch, dynamic import, code splitting, CSS modules, images, JSON/YAML/raw, tokens, inline requires; acceptance: cataloged fixtures with owners and refresh cadence.
- [ ] Story: CI sharding with smoke/full modes; acceptance: runtime budgets published, shards runnable on PRs vs nightly full.
- [ ] Story: Telemetry for diff outcomes, perf timings, failure taxonomy; acceptance: dashboard links and alert thresholds.

## Epic: Rust Core Orchestrator

- [x] Story: Port RequestTracker/task scheduler to Rust with deterministic ordering; acceptance: property tests for ordering and invalidation parity vs JS.
- [ ] Story: AssetGraph/BundleGraph orchestration in Rust; acceptance: graph shape/ID parity snapshots and golden comparisons.
- [ ] Story: Cache integration (LMDB) with versioned keys; acceptance: mismatch detection, auto-invalidate/migrate flow, documented schema versioning.
- [ ] Story: Error/diagnostic propagation; acceptance: codes, hints, locations match JS on fixture set.

## Epic: Pipeline Scheduler and Plugin Hosting

- [ ] Story: Rust pipeline scheduler for resolver → transformers → bundler → namer → packager → optimizer → compressor; acceptance: end-to-end pipeline parity on golden fixtures.
- [ ] Story: JS plugin host bridge (Node RPC or embedded runtime) with lifecycle hooks, streaming payloads, cancellation; acceptance: load/shedding/backpressure tests and contract docs.
- [x] Story: Contract tests per plugin category (transformer, resolver, packager, optimizer, reporter) against golden outputs; acceptance: per-plugin baseline stored and enforced in CI.
- [ ] Story: Structured ABI/IDL for plugin calls with versioning/compat checks; acceptance: version negotiation and upgrade/fallback behavior tested.

## Epic: Watch/HMR Parity

- [ ] Story: Watcher adapter with debounce parity per platform; acceptance: record/replay traces and pass ordering checks.
- [ ] Story: Incremental rebuild invalidation parity; acceptance: dirty-set comparisons against JS across fixture edits.
- [x] Story: HMR message ordering and React-refresh/runtime injection parity; acceptance: scripted HMR sessions with expected transcript.

## Epic: Observability and Perf

- [ ] Story: Metrics spans around FFI, scheduler stages, cache hits/misses, watch latency; acceptance: dashboards and sampling documented.
- [ ] Story: Perf budgets in CI (cold/warm timings, memory); acceptance: thresholds checked in PR CI with clear failure messaging.
- [ ] Story: Panic/timeout watchdog with JS fallback and user notice; acceptance: chaos tests that trigger fallback and log/telemetry assertions.

## Epic: Rollout and Fallback

- [x] Story: Feature flags (`rust_engine_enabled`, `rust_engine_dual_run`, `rust_engine_force_js_fallback`) wired; acceptance: flag matrix tested in CLI and CI.
- [ ] Story: Opt-in/out docs, expected diffs, fallback semantics; acceptance: published in repo docs and linked from CLI help.
- [ ] Story: Rollout playbook: dogfood → beta → default-on → JS removal; acceptance: exit criteria and rollback steps documented with owners/dates.

## Epic: Compatibility and Cache

- [x] Story: Cache key schema versioning and migration/auto-invalidate flow; acceptance: migration script, schema docs, and CI checks.
- [x] Story: Hash parity tests (bundles, source maps, assets) across OS/arch/Node matrix; acceptance: matrix automation with tolerances.
- [x] Story: WASM fallback validation for platforms without native builds; acceptance: WASM CI lane with perf/functional thresholds.

## Epic: Plugin Parity

- [ ] Story: Audit JS-only plugins; prioritize porting/shimming; acceptance: tracked list with owners/ETA and risk notes.
- [x] Story: Golden tests per plugin with diagnostics/asset metadata comparisons; acceptance: enforced in CI with allowed deltas documented.
- [ ] Story: Deprecation path for unsupported JS internals; acceptance: published contract doc and communicated timelines.
