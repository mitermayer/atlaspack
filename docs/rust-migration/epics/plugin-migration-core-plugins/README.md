# Plugin Migration – Core Engine Plugins

Focus: migrate core transformers, resolver, bundlers, packagers, and namer to Rust-backed implementations for the Rust engine, while keeping JS plugins as the public interface and source of truth for behavior.

## Key paths

- JS plugins (core):
  - Transformers: `packages/transformers/{css,html,js,image,inline,inline-string,json,raw,svg,tokens,yaml}/`.
  - Resolver: `packages/resolvers/default/`.
  - Bundlers: `packages/bundlers/{default,library}/`.
  - Packagers: `packages/packagers/{css,html,js,raw,raw-url,svg,ts,wasm,webextension,xml}/`.
  - Namer: `packages/namers/default/`.
- Rust crates:
  - Core transformers: `crates/atlaspack_plugin_transformer_{css,html,js,json,raw,svg,image,inline,inline_string,tokens,yaml}/`.
  - Resolver: `crates/atlaspack_plugin_resolver/`.
  - Bundler/packager/namer crates:
    - Namer: `crates/atlaspack_plugin_namer_default/`
    - Bundlers: `crates/atlaspack_plugin_bundler_default/`, `crates/atlaspack_plugin_bundler_library/`
    - Packagers: `crates/atlaspack_plugin_packager_*`
- Parity tests and fixtures:
  - Plugin parity tests: `packages/core/core/test/plugin-parity/*.test.ts`.
  - Plugin pipeline tests: `packages/core/core/test/pluginPipeline.test.ts` and `.../integration/plugin-pipeline.test.ts`.
  - Fixtures/goldens: `packages/core/core/test/__fixtures__/plugin-parity/<plugin>/` and `.../__fixtures__/plugin-pipeline/`.

## Commands

- Plugin parity suite (core transformers):
  - `yarn test:js:unit --grep "plugin parity"`
- Pipeline hooks/order:
  - `yarn test:js:unit --grep "plugin pipeline"`
- Dual-run smoke (for overall engine parity):
  - `ATLASPACK_ENGINE=dual yarn test:js:unit packages/examples/kitchen-sink/__tests__/dual-smoke.test.ts`

## Definition of Done

- Core transformers and the default resolver have Rust-backed implementations.
- Bundlers, packagers, and the default namer have Rust plugin implementations.
- Extended plugin parity fixtures exist for core plugins.

## Breakdown

### T12: Bundler/Packager/Namer Crates

- **T12a: Namer**
  - Implement `crates/atlaspack_plugin_namer_default`.
  - Port logic from `packages/namers/default`.
  - Validation: Unit tests matching JS behavior.
- **T12b: Bundler**
  - Implement `crates/atlaspack_plugin_bundler_default`.
  - Port logic from `packages/bundlers/default`.
  - Implement `crates/atlaspack_plugin_bundler_library`.
- **T12c: Packagers**
  - Implement core packagers (js, css, html, etc.).

## Before merge (checklist)

- [ ] Run Epic 0 baseline commands.
- [ ] Run plugin parity suite: `yarn test:js:unit --grep "plugin parity"`.
- [ ] Run pipeline hook/order tests: `yarn test:js:unit --grep "plugin pipeline"`.
- [ ] Verify core plugin goldens under `packages/core/core/test/__fixtures__/plugin-parity/<plugin>/` and `.../__fixtures__/plugin-pipeline/`.
- [ ] Confirm determinism (rerun tests, no unexpected golden drift) and document any intentional updates.
