# Plugin Migration – Core Engine Plugins — Start Here

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
  - Bundler/packager/namer crates: new `crates/atlaspack_plugin_bundler_*`, `crates/atlaspack_plugin_packager_*`, and `crates/atlaspack_plugin_namer_*` to be created.
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

## Definition of done

- Core transformers and the default resolver have Rust-backed implementations:
  - JS plugins delegate to Rust crates when the Rust engine is active.
  - Plugin parity tests remain green under JS engine, and dual-run harness reports no differences for covered fixtures.
- Bundlers, packagers, and the default namer have Rust plugin implementations:
  - Bundle graph shape and output filenames for the Rust engine match JS goldens for the documented fixtures.
- Extended plugin parity fixtures exist for core plugins:
  - JS/CSS/HTML/image/raw/svg/json/yaml fixtures cover scope hoisting, code splitting, HMR/watch, and sourcemaps.
  - CI enforces parity on these fixtures for JS engine; dual-run is used to monitor Rust.

## Before merge (checklist)

- [ ] Run Epic 0 baseline commands.
- [ ] Run plugin parity suite: `yarn test:js:unit --grep "plugin parity"`.
- [ ] Run pipeline hook/order tests: `yarn test:js:unit --grep "plugin pipeline"`.
- [ ] Verify core plugin goldens under `packages/core/core/test/__fixtures__/plugin-parity/<plugin>/` and `.../__fixtures__/plugin-pipeline/`.
- [ ] Confirm determinism (rerun tests, no unexpected golden drift) and document any intentional updates.
