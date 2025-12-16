# Rust Migration Plan Index

This directory tracks the product requirements, epics, stories, and references for migrating Atlaspack orchestration from JS/TS to Rust while preserving behavior.

## Documents

- [PRD](./prd.md) — background, goals, scope, milestones, risks.
- [Epics and Stories](./epics.md) — execution breakdown per workstream.
- [Plugin Inventory](./plugin-inventory.md) — status of all plugins (JS vs Rust) and mapping to migration epics.
- [Rust Engine Validation Playbook](./rust-engine-validation-playbook.md) — guide for enabling the Rust engine in existing Atlaspack projects.
- [Requirements](./requirements.md) — functional and non-functional requirements plus success metrics.
- [Testing Plan](./testing-plan.md) — JS-baseline TDD strategy, artifacts, and integration hand-off.

## Recommended Execution Sequence

This roadmap outlines the recommended order of operations to complete the migration, moving from core correctness to performance and finally operational readiness.

### 1. Core Correctness & Parity (Finish Phase 2)

Focus: ensuring the engine produces correct outputs and diagnostics before optimizing or rolling out.

1. **Finish Orchestrator Diagnostics** (Epic: Rust Core Orchestrator)
   - Ensure error codes, hints, and locations match JS exactly.
   - _Why_: User trust depends on readable, familiar errors; parity tests must cover failure cases.
2. **Incremental Invalidation Parity** (Epic: Watch & HMR Parity)
   - Verify dirty sets and rebuild behavior match JS for edit scripts.
   - _Why_: Correctness of incremental builds is critical for dev experience and cache reliability.
3. **Plugin ABI/IDL** (Epic: Pipeline Scheduler & Plugin Hosting)
   - Formalize the plugin RPC contract with versioning.
   - _Why_: Prevents subtle breakage as we migrate plugins and change internal data structures.

### 2. Core Plugin Migration (Phase 3 Start)

Focus: moving the "happy path" build pipeline fully to Rust.

4. **Bundler/Packager/Namer Crates** (Epic: Plugin Migration – Core Engine Plugins)
   - Implement Rust-native bundlers (`default`, `library`), packagers (`js`, `css`, `html`), and namer (`default`).
   - _Why_: These are the heaviest parts of the graph operation; moving them to Rust unlocks the biggest perf gains.
5. **Core Transformers & Resolver** (Epic: Plugin Migration – Core Engine Plugins)
   - Ensure all core transformers (JS, CSS, HTML, etc.) and the default resolver are wired as Rust-native.
   - _Why_: Completes the "core path" transformation pipeline in Rust.

### 3. Optimizer Migration & Performance

Focus: heavy computational tasks and build optimization.

6. **Rust-Native Optimizers** (Epic: Plugin Migration – Optimizers & Compressors)
   - Port/wire `css` (Lightning CSS), `js` (SWC minifier), `image`, and `inline-requires` optimizers to Rust.
   - _Why_: Minification and optimization are the most CPU-intensive build steps; Rust here is essential for production build speed.
7. **Observability & Perf Budgets** (Epic: Observability and Perf)
   - Implement metrics spans, dashboards, and CI perf budgets.
   - _Why_: We need visibility into whether the Rust engine is actually faster and stable before broad rollout.

### 4. Rollout & Ecosystem (Operational Readiness) - Phase 4

Focus: preparing for broad adoption, handling the long tail, and ensuring full JS plugin compatibility.

8. **Rollout Docs & Playbook** (Epic: Rollout and Fallback)
   - Finalize opt-in/out docs, CLI help, and the phased rollout plan.
   - _Why_: Users need clear instructions on how to use (or avoid) the new engine.
9. **Ecosystem Adapters & Deprecation** (Epic: Plugin Migration – Runtimes, Reporters & Ecosystem Adapters)
   - Define strategy for Babel/PostCSS/MDX (Rust-native vs JS adapter) and deprecate unsupported JS internals.
   - _Why_: Closes the loop on the long tail of plugins and signals the end of "JS-only" support.
10. **Panic Watchdog & Fallback** (Epic: Observability and Perf)
    - Implement the crash watchdog with seamless JS fallback.
    - _Why_: Safety net for the final rollout to production.
11. **Ecosystem Compatibility & JS Host Parity** (Phase 4)
    - Implement full JS Host Infrastructure (T20), JS Plugin Execution (T21), and Runtime Bundle Graph (T22).
    - _Why_: Required to support the vast ecosystem of existing JS plugins without rewriting them all in Rust immediately.

### 5. Validation & Stabilization (Phase 5) - CURRENT

Focus: verifying the engine against real-world examples and fixing critical infrastructure bugs.

12. **NAPI Deserialization Fix** (T_INFRA_1)
    - Fix NAPI `entries` deserialization bug for absolute paths.
    - _Why_: Ensures correct handling of file paths in the Rust engine, critical for consistent builds.
13. **Kitchen Sink Validation** (T_VAL_1)
    - Run Kitchen Sink tests against Rust engine.
    - _Why_: Validates the engine against a comprehensive set of features and edge cases.
14. **Performance Benchmarking** (T_VAL_2)
    - Benchmark Rust vs JS performance.
    - _Why_: Quantify the performance benefits of the Rust engine.

---

## Epics and Tickets

- Epic 0: JS Baseline Tests: `./epics/epic-0-baseline-tests/`
- Parity Baseline & Dual-Run: `./epics/parity-dual-run/`
- Rust Core Orchestrator: `./epics/rust-core-orchestrator/`
- Pipeline Scheduler & Plugin Host: `./epics/pipeline-scheduler-plugin-host/`
- Watch & HMR Parity: `./epics/watch-hmr-parity/`
- Observability & Performance: `./epics/observability-perf/`
- Rollout & Fallback: `./epics/rollout-fallback/`
- Compatibility & Cache: `./epics/compatibility-cache/`
- Plugin Parity: `./epics/plugin-parity/`
- Plugin Migration – Core Engine Plugins: `./epics/plugin-migration-core-plugins/`
- Plugin Migration – Optimizers & Compressors: `./epics/plugin-migration-optimizers/`
- Plugin Migration – Runtimes & Ecosystem Adapters: `./epics/plugin-migration-runtimes-adapters/`
- Ecosystem Compatibility & JS Host Parity (Phase 4): `./epics/ecosystem-compatibility/`

## Source-of-truth references in repo

- Core orchestrator and CLI: `packages/core/core/src/Atlaspack.ts`, `packages/core/cli/src/cli.ts`, `packages/core/core/src/RequestTracker.ts`, `packages/core/core/src/worker.ts`.
- Rust bindings/loader: `packages/core/rust/index.js`, `crates/node-bindings/`.
- Pipelines config: `packages/configs/default/index.json`.
- Existing Rust engine and plugins: `crates/atlaspack`, `crates/atlaspack_core`, `crates/atlaspack_plugin_*`, `packages/utils/node-resolver-rs/`, `packages/transformers/js/core/`.
- Sourcemaps/cache: `packages/core/source-map/`, `crates/atlaspack_sourcemap`, `crates/lmdb-js-lite`.
- Observability/monitoring: `crates/atlaspack_monitoring`, `crates/atlaspack_memory_profiler`.

## Relevant documentation

- Bundling and scope hoisting: `docs/Scopehoisting.md`, `docs/Scopehoisting Transformer.md`, `docs/Scopehoisting Packager.md`, `docs/Symbol Propagation.md`, `docs/DefaultBundler.md`.
- Pipeline behaviors: `docs/ManualBundling.md`, `docs/Deferring.md`, `docs/BundlerExamples.md`, `docs/JSX-configuration.md`.
- Features: `docs/features/Conditional Bundling.md`.
- CLI usage and environment: `docs/cli/README.md`, `docs/cli/build-commands.md`, `docs/cli/environment-variables.md`.
- Testing and CI: `docs/debugging-tests.md`, `docs/Continuous Integration/Native Binary Builds.md`.

## How to use this plan

- Start with the PRD for context and goals.
- Use Requirements to validate design/implementation proposals and to gate rollouts.
- Use Epics/Stories to spin concrete tickets and track progress across feature flags and parity milestones.
