# Plugin Migration – Runtimes, Reporters & Ecosystem Adapters — Start Here

Focus: ensure runtimes and reporters work seamlessly with the Rust engine, and define a clear strategy for ecosystem adapters (Babel, PostCSS, MDX, etc.) that may remain JS-based but must interoperate with Rust orchestrator data.

## Implementation Notes

- RuntimeBundleGraph implemented as DTO-backed proxy.

## Key paths

- Runtimes:
  - `packages/runtimes/{js,hmr,react-refresh,service-worker,webextension}/`.
- Reporters:
  - `packages/reporters/*/` (CLI, dev server, tracer, LSP, bundle analysis, build metrics, etc.).
- Ecosystem adapter transformers:
  - `packages/transformers/{babel,postcss,mdx,pug,posthtml,less,sass,worklet,webmanifest,xml,toml,graphql,jsonld,typescript-*}/`.
- Observability & telemetry:
  - `packages/core/core/test/telemetry.test.ts`.
  - `packages/core/core/test/perf-counters.test.ts`.
  - `crates/atlaspack_monitoring/`, `crates/atlaspack_memory_profiler/`.

## Commands

- Telemetry and perf:
  - `yarn test:js:unit packages/core/core/test/telemetry.test.ts`
  - `yarn test:js:unit --grep "perf"`
- HMR/watch parity:
  - `yarn test:js:unit packages/examples/kitchen-sink/__tests__/watch-hmr.test.ts`
- Plugin parity suite (for runtime- and reporter-sensitive fixtures):
  - `yarn test:js:unit --grep "plugin parity"`

## Definition of done

- Runtimes work identically under JS and Rust engines:
  - The Rust engine exposes all metadata required by HMR/react-refresh/service-worker/webextension runtimes.
  - HMR/watch tests pass with Rust engine enabled and in dual-run mode.
- Reporters are engine-agnostic:
  - CLI/dev-server/tracer/LSP reporters receive equivalent build events and diagnostics from JS and Rust.
  - Integration tests or fixtures verify that reporter outputs do not regress when using the Rust engine.
- Ecosystem adapters have a documented strategy:
  - For each adapter (Babel/PostCSS/MDX/etc.), status is documented as:
    - Rust-native, where APIs exist and are wired.
    - JS adapter over plugin RPC, where keeping JS makes sense.
    - Deprecated, where long-term support is not intended.
  - Tests exist for adapters that will be supported long-term, using Rust engine where applicable.

## Before merge (checklist)

- [ ] Run Epic 0 baseline commands.
- [ ] Run telemetry and perf tests: `yarn test:js:unit packages/core/core/test/telemetry.test.ts` and `yarn test:js:unit --grep "perf"`.
- [ ] Run watch/HMR tests with and without Rust engine enabled: `yarn test:js:unit packages/examples/kitchen-sink/__tests__/watch-hmr.test.ts` and `ATLASPACK_ENGINE=rust` or `dual` variants.
- [ ] Verify reporters behave consistently under JS and Rust engines for key workflows (build, watch, HMR).
- [ ] Update the plugin inventory/doc to list runtimes, reporters, and ecosystem adapters with their migration status and guidance.
