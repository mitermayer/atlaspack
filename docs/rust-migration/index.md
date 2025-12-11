# Rust Migration Plan Index

This directory tracks the product requirements, epics, stories, and references for migrating Atlaspack orchestration from JS/TS to Rust while preserving behavior.

## Documents

- [PRD](./prd.md) — background, goals, scope, milestones, risks.
- [Epics and Stories](./epics.md) — execution breakdown per workstream.
- [Requirements](./requirements.md) — functional and non-functional requirements plus success metrics.

## Epics and Tickets

- Parity Baseline & Dual-Run: `./epics/parity-dual-run/`
- Rust Core Orchestrator: `./epics/rust-core-orchestrator/`
- Pipeline Scheduler & Plugin Host: `./epics/pipeline-scheduler-plugin-host/`
- Watch & HMR Parity: `./epics/watch-hmr-parity/`
- Observability & Performance: `./epics/observability-perf/`
- Rollout & Fallback: `./epics/rollout-fallback/`
- Compatibility & Cache: `./epics/compatibility-cache/`
- Plugin Parity: `./epics/plugin-parity/`

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
