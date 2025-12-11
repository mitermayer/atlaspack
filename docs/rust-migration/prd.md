# Atlaspack Rust Orchestration Migration PRD

## Background

Atlaspack currently uses JS/TS for orchestration (CLI, request tracking, pipeline scheduling, reporters) with Rust powering the heaviest paths (resolvers, transformers, sourcemaps, cache). The hybrid model creates duplication, higher latency, cache compatibility risk, and parity drift. A Rust-first orchestrator already exists behind feature flags (`AtlaspackV3`), but it lacks full parity and rollout guardrails. The goal is to move orchestration and pipeline execution entirely into Rust while preserving user-visible behavior, plugin compatibility, and operational reliability.

## Goals

- Deliver functionally equivalent builds, diagnostics, HMR/watch behavior, and CLI semantics when using the Rust engine.
- Provide measurable performance wins (cold and warm builds, memory) relative to the JS orchestrator.
- Maintain plugin compatibility during transition via stable FFI/ABI and a JS host bridge; enable deprecation only after parity.
- Keep cache integrity and deterministic outputs (bundle hashes, filenames, source maps, graph shapes) across OS/arch/Node matrix.
- Ship with feature-flagged rollout, dual-run parity checks, and instant JS fallback.

## Non-goals

- Redesigning bundling features or CLI UX.
- Removing JS plugins before Rust parity exists or before a JS-host bridge is shipped.
- Introducing new cache formats beyond versioned compatibility/migration needed for Rust.
- Changing supported Node/OS/arch matrix.

## Scope

- Orchestration: request tracker, asset/bundle graphs, task scheduling, invalidation, worker lifecycle.
- Pipelines: resolver → transformers → bundler → namer → packager → optimizer → compressor, including scope hoisting and tree shaking.
- FFI/RPC: Node bindings (`crates/node-bindings`, `packages/core/rust/index.js`) contracts, ABI versioning, WASM fallback.
- Watch/HMR: file watching, debounce, rebuild triggers, event ordering, runtime injections.
- Cache: LMDB layout/keying, versioning/migration, hash parity.
- CLI/UX: commands/flags, logs/diagnostics formatting, progress output, error codes.
- Observability: perf metrics, crash reporting, logging, SLOs.

## Success metrics (proposed targets)

- Cold build: ≥20% faster than JS baseline on representative fixtures.
- Warm rebuild: ≥30% faster; watch latency p95 within +10% of target budget.
- Memory: ≤25% increase vs JS baseline; aim for reduction after tuning.
- Parity: zero intentional behavior regressions; bundle/hash/source-map parity within defined diff tolerances; dual-run CI green.
- Reliability: crash/timeout rate not worse than baseline; automatic JS fallback works and is observable.

## Functional requirements

- **Engine parity**: Rust drives request/asset/bundle graphs with deterministic scheduling; outputs, filenames, source maps, diagnostics match JS within tolerance.
- **CLI/Config parity**: All existing commands/flags/config resolution (including `.parcelrc` defaults in `packages/configs/default/index.json`) behave identically; support `--engine=rust|js` and dual-run comparison flag.
- **Plugin compatibility**: Support existing JS plugins via RPC/FFI host; lifecycle hooks, diagnostics, and asset metadata preserved. Rust-native plugins pluggable without JS wrappers.
- **FFI/ABI stability**: Versioned ABI for `node-bindings`; structured errors; cancellation/backpressure; streaming payloads for large graphs/assets; WASM path validated.
- **Watch/HMR**: Invalidation, debounce, rebuild triggers, and HMR message ordering match JS behavior; React-refresh and SW runtimes preserved.
- **Cache compatibility**: Versioned keys; migration or safe invalidation; hash parity for assets/bundles/source maps; detection of mismatched engine versions.
- **Observability**: Metrics for perf (cold/warm times, memory), error taxonomy, FFI latency, cache hit rate; log formatting parity; Sentry hooks preserved.

## Non-functional requirements

- **Performance**: Meet targets above; guardrails to prevent regressions (CI perf budgets, profiling hooks).
- **Reliability**: Panic safety and graceful degradation to JS; watchdogs/timeouts around FFI; retries for transient FS/watch failures.
- **Compatibility**: Supported OS/arch/Node matrix unchanged; deterministic outputs across platforms; reproducible builds in CI.
- **Security**: No expanded network/FS surface; sandbox parity with JS path.

## Rollout strategy

- Feature flags: `rust_engine_enabled`, `rust_engine_dual_run`, `rust_engine_force_js_fallback` (naming TBD), with CLI overrides.
- Dual-run CI lane: run JS and Rust engines on curated fixtures; diff bundles, graphs, diagnostics, hashes, and timings with tolerance rules; sharded for cost.
- Phased release: internal dogfood → opt-in beta (flag) → default-on with fallback → remove JS path after sustained success.
- Fallback: automatic JS fallback on fatal Rust errors, with user-visible notice and telemetry.
- Observability: dashboards for perf and failure modes; error sampling to Sentry; alerting on parity breaks or perf regressions.

## Risks and mitigations

- **Plugin parity gaps**: Golden tests per plugin; contract docs; JS host bridge maintained until Rust replacements exist; fast fallback.
- **Cache incompatibility**: Versioned schema; migration script; auto-invalidate on mismatch; parity tests on hash keys.
- **FFI deadlocks/perf**: Async streaming API with backpressure; timeouts; soak tests; structured cancellation.
- **Watcher/HMR drift**: Dedicated fixtures for event ordering; platform matrix; debounce tuning; recorded trace comparisons.
- **CI cost**: Sharded parity suites; smoke vs full modes; nightly full runs; caching of fixture outputs.
- **Observability gaps**: Early metrics wiring; error taxonomies; redaction rules.

## Dependencies

- Existing fixtures and integration suites; LMDB bindings; watcher crates; Node bindings build pipeline; Sentry/telemetry plumbing; CI capacity for dual-run.

## Milestones

1. **Parity baseline**: dual-run harness, fixtures, diff tolerances, feature flags wired.
2. **Rust core orchestration**: request tracker, graph orchestration, cache integration, deterministic scheduling behind flag.
3. **Plugin RPC parity**: JS host bridge, ABI versioning, contract tests; Rust pipeline scheduler drives plugins.
4. **Watch/HMR parity**: invalidation, debounce, HMR event ordering, incremental rebuild tests.
5. **Perf hardening**: profiling, memory tuning, perf budgets enforced in CI.
6. **Rollout**: dogfood → beta → default-on; JS fallback retained; eventual removal after success window.

## Open questions

- Log ordering tolerance—what differences are acceptable in diff harness?
- Cache migration UX—automatic invalidate vs migration? Any user prompts?
- Minimum perf win required before default-on? (set per product?
- Timeline to deprecate JS path after parity window?
- How to handle third-party plugins that rely on undocumented JS internals?
