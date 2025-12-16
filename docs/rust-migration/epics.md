# Epics and Stories

Details: see per-epic folders under `docs/rust-migration/epics/<epic>/` (indexed in `docs/rust-migration/index.md`). CI/dual-run wiring and alerting are handled by integration; this project provides flags, artifacts, schemas, and docs for them to consume. Start with Epic 0 (baseline tests) below.

## Epic 0: JS Baseline Test Scaffolding

- [x] Story: Create shared normalization/utils and first smoke tests (dual-run, request/invalidation) on JS engine with stable artifacts. See `docs/rust-migration/epics/epic-0-baseline-tests/`.

## Epic: Maintenance & Infrastructure

- [ ] Story: Fix `yarn test` infrastructure when running from source (`ATLASPACK_REGISTER_USE_SRC=true`).
  - **Issue:** Worker processes crash during startup when running tests from source, causing timeouts in tests that wait for worker readiness (e.g., `telemetry.test.ts`).
  - **Context:** The issue appears related to `babel-register` usage in worker initialization sequence.
  - **Workaround:** Run tests via `yarn workspace @atlaspack/core test` (uses built artifacts) instead of root `yarn test`.

## Epic: Parity Baseline and Dual-Run Harness

- [x] Story: Add CLI/env flags (`--engine=rust|js|dual`) with validation; acceptance: flags documented, dual-run executable locally and in CI.
- [x] Story: Dual-run harness producing bundle/graph/hash/diag diffs with tolerance rules; acceptance: diff artifacts stored, red/green criteria defined.
- [x] Story: Fixture suite covering scope hoisting, HMR/watch, dynamic import, code splitting, CSS modules, images, JSON/YAML/raw, tokens, inline requires; acceptance: cataloged fixtures with owners and refresh cadence.
- [ ] Story: CI sharding with smoke/full modes; acceptance: runtime budgets published, shards runnable on PRs vs nightly full.
- [ ] Story: Telemetry for diff outcomes, perf timings, failure taxonomy; acceptance: dashboard links and alert thresholds.

## Epic: Rust Core Orchestrator (T2)

- [x] Story: AssetGraph/BundleGraph orchestration in Rust; acceptance: graph shape/ID parity snapshots and goldens.
- [x] Story: Cache integration (LMDB) with documented schema versioning.
- [x] Story: Error/diagnostic propagation; codes/hints/locations match JS.
- [x] Story: Fix package.json target parsing bug (A1); acceptance: strict validation logic updated to handle browser aliases.

## Epic: Pipeline Scheduler & Plugin Hosting (T3)

- [x] Story: Scheduler and JS plugin host bridge.
- [x] Story: Contract tests per plugin category (JS/CSS/HTML/etc.).
- [x] Story: Structured ABI/IDL for plugin calls with versioning/compat checks.

## Epic: Watch & HMR Parity (T4)

- [x] Story: Watcher adapter parity.
- [x] Story: HMR message ordering parity.
- [x] Story: Incremental rebuild invalidation parity.

## Epic: Observability and Perf (T5)

- [x] Story: Metrics spans around FFI, scheduler stages, cache hits/misses, watch latency (dashboards & sampling docs).
  - [x] Sub-task: Fix ConfigLoader deserialization error (T15 blocker).
  - [x] Sub-task: Implement V3 Reporter Integration (`runReporterReport`) to enable trace collection.
  - [x] Sub-task: Verify trace spans in `telemetry.test.ts`.
- [ ] Story: Perf budgets in CI (cold/warm timings, memory) with thresholds.
- [x] Story: Panic/timeout watchdog with JS fallback and chaos tests.

## Epic: Rollout and Fallback (T6)

- [x] Story: Feature flags wired (`rustEngineEnabled`, `rustEngineDualRun`, `rustEngineForceJsFallback`).
- [x] Story: Opt-in/out docs, expected diffs, fallback semantics (docs, CLI help).
- [x] Story: Rollout playbook: dogfood → beta → default-on → JS removal.

## Epic: Compatibility & Cache (T7)

- [x] Story: Cache key schema versioning and migration/auto-invalidate flow.
- [x] Story: Hash parity tests across OS/arch/Node matrices.
- [x] Story: WASM fallback validation for platforms without native builds.

## Epic: Plugin Parity (T8)

- [x] Story: Audit JS-only plugins; prioritize porting/shimming.
- [x] Story: Golden tests per plugin.
- [x] Story: Deprecation path for unsupported JS internals; acceptance: published contract doc and communicated timelines.

## Epic: Plugin Migration – Core Engine Plugins

- [x] Story: Rust-backed core transformers and default resolver; acceptance: all core transformers and the default resolver invoke Rust plugins under the Rust engine, with plugin parity tests green.
- [x] Story: Rust bundlers, packagers, and namer for Rust engine; acceptance: default/library bundlers, core packagers, and the default namer have Rust plugin implementations with bundle/naming goldens matching JS.
  - [x] T12a: Default Namer (Rust crate + integration).
  - [x] T12b: Default Bundler (Rust crate + integration).
  - [x] T12c: Packagers (Rust crates for js/css/html/etc).
- [ ] Story: Extended plugin parity fixtures for core plugins; acceptance: additional fixtures for JS/CSS/HTML/image/raw/svg/json/yaml covering scope hoisting, code splitting, HMR, and sourcemaps, enforced in CI.

## Epic: Plugin Migration – Optimizers & Compressors

- [x] Story: Rust-native optimizers for CSS, JS, image, and inline requires; acceptance: css/js/image/inline-requires optimizers are backed by Rust plugins, with outputs and sourcemaps matching JS goldens.
  - [x] Sub-task: Inline-requires optimizer ported and wired.
  - [x] Sub-task: CSS optimizer ported and wired (crates/atlaspack_plugin_optimizer_css).
  - [x] Sub-task: JS optimizer ported and wired (crates/atlaspack_plugin_optimizer_swc).
- [ ] Story: JS-only optimizers wrapped behind stable RPC contracts; acceptance: cssnano/htmlnano/terser/svgo/data-url/blob-url are documented and invoked via plugin RPC with parity tests and a deprecation or replacement strategy where appropriate.
- [ ] Story: Optimizer plugin parity golden suite; acceptance: per-optimizer fixtures and goldens enforced in CI, with allowed deltas documented.

## Epic: Plugin Migration – Runtimes, Reporters & Ecosystem Adapters

- [x] Story: Rust engine metadata contract for runtimes; acceptance: runtimes (JS/HMR/React-refresh/service-worker/webextension) consume a stable metadata interface from the Rust engine, tested via HMR/watch and plugin parity suites.
- [ ] Story: Reporter compatibility with Rust engine; acceptance: reporters (CLI/dev-server/tracer/LSP/etc.) receive equivalent events/diagnostics from JS and Rust engines with integration tests and docs.
- [x] Story: Ecosystem adapter strategy for Babel/PostCSS/MDX/etc.; acceptance: documented status per adapter (Rust-native, JS adapter, deprecated) with migration guidance and tests for maintained adapters.

## Epic: JS Plugin Execution Support in Rust Engine (T13)

- [x] Story: JS Host Infrastructure; acceptance: `PluginOptions` and `MutableAsset` implemented in `atlaspack-v3` to support JS plugins running under the Rust engine.
- [x] Story: JS Plugin Execution hooks; acceptance: `runNamerName`, `runOptimizerOptimize`, and `runPackagerPackage` implemented in `atlaspack-v3` and wired to Rust engine.
- [x] Story: Runtime Parity; acceptance: `RuntimeBundleGraph` implemented to support JS-side graph traversals during plugin execution (from T11).

## Epic: Ecosystem Compatibility & JS Host Parity (Phase 4)

- [x] Story: JS Host Infrastructure (T20); acceptance: `PluginOptions` and `MutableAsset` methods implemented in `atlaspack-v3`.
- [x] Story: JS Plugin Execution (T21); acceptance: `runNamer`, `runOptimizer`, `runPackager`, and `runValidator` implemented in `worker.ts`. (Note: Resolvers/Transformers are implemented but blocked by T20).
- [x] Story: Runtime Bundle Graph Implementation (T22); acceptance: MVP implemented (Async Import resolution supported via DTO).
- [x] Story: JS-only Optimizers Wrapper (T14); acceptance: `htmlnano` and `svgo` run via the new RPC system.
- [x] Story: Reporter Parity (T19); acceptance: CLI/DevServer reporters receive events from Rust.

## Epic: Validation & Stabilization (Phase 5)

- [ ] Story: Fix NAPI `entries` deserialization bug (T_INFRA_1).
- [ ] Story: Run Kitchen Sink tests against Rust engine (T_VAL_1).
- [ ] Story: Benchmark Rust vs JS performance (T_VAL_2).
- [ ] Story: Complete RuntimeBundleGraph coverage (T_VAL_3); acceptance: implement `getAssetById`, `getSymbolResolution`, and `getEntryRoot` for runtime consumers.
- [ ] Story: JS Bundler/Compressor stance (T_VAL_4); acceptance: either implement JS bundler/compressor hooks in `worker.ts` or explicitly document Rust-only bundler/compressor support as the stable path.
