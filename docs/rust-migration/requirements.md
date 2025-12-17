# Requirements

## Status Snapshot (Dec 2025)

- **Core Engine**: Complete (Phase 2 & 3).
- **Plugin Support**: In Progress (Core plugins done, JS Adapters pending).
- **Ecosystem Compatibility**: Partially Met (Phase 4 complete, Phase 5 validation pending).

## Functional

- Engine: Rust owns request/asset/bundle graph orchestration; deterministic scheduling; identical outputs and IDs to JS within tolerance.
- CLI/Config: Same commands/flags and config resolution (including defaults in `packages/configs/default/index.json`); support `--engine=rust|js` and dual-run mode; preserve environment variable handling.
- Plugins: JS plugins supported via host bridge with lifecycle hooks, diagnostics, asset metadata; Rust plugins pluggable directly; reporter outputs unchanged.
- FFI/ABI: Versioned ABI for `node-bindings`; streaming payloads; structured errors; cancellation; backpressure; WASM path tested.
- Watch/HMR: File watching, debounce, incremental invalidation, HMR message ordering, and runtime injections match JS behavior.
- Cache: Versioned key schema; migration or safe invalidation; hash parity for assets/bundles/source maps; detection of engine-version mismatch.
- Observability: Metrics for perf, errors, cache hit rate, FFI latency, watch latency; log/diagnostic formatting parity; Sentry hooks maintained.

## Non-functional

- Performance: Cold ≥20% faster; warm ≥30% faster; watch p95 within target; memory ≤25% over baseline and ideally lower after tuning.
- Reliability: Panic-safe; graceful JS fallback on fatal errors; watchdogs/timeouts around FFI; retries for transient FS/watch failures.
- Compatibility: Supported OS/arch/Node matrix unchanged; deterministic outputs across platforms; reproducible builds in CI.
- Security: No expanded network/FS surface; same sandbox assumptions as JS path.

## Success criteria

- Dual-run CI passes with no unapproved diffs (bundles, graphs, diagnostics, hashes) on curated fixtures.
- Perf budgets met or exceeded on benchmark suite; no regressions beyond tolerance.
- Cache integrity maintained; no data-corrupting migrations; clear user messaging on invalidations.
- Plugin suites (JS and Rust) green under Rust orchestrator; HMR/watch fixtures stable.
- Rollout gates: dogfood success, beta adoption, default-on with stable metrics for agreed window before removing JS path.
