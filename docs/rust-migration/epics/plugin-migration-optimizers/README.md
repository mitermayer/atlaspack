# Plugin Migration – Optimizers & Compressors — Start Here

Focus: move CSS/JS/image optimization and related transforms to Rust-backed plugins where possible, and clearly define the behavior and lifecycle of remaining JS-only optimizers.

## Key paths

- JS optimizer plugins:
  - `packages/optimizers/{css,cssnano,htmlnano,image,inline-requires,svgo,swc,terser,blob-url,data-url}/`.
- Rust optimizer crates:
  - Existing: `crates/atlaspack_plugin_optimizer_inline_requires/`.
  - Planned: `crates/atlaspack_plugin_optimizer_{css,js,image,blob_url,data_url,...}/`.
- Parity tests and fixtures:
  - Plugin parity tests: `packages/core/core/test/plugin-parity/*.test.ts` (to be extended for optimizers).
  - Golden fixtures: `packages/core/core/test/__fixtures__/plugin-parity/<plugin>/`.

## Commands

- Plugin parity suite (extended to optimizers):
  - `yarn test:js:unit --grep "plugin parity"`
- Integration tests that exercise optimized bundles (as needed):
  - e.g. `yarn test:js:unit --grep "minify"` (when such tests exist) or targeted integration suites.

## Definition of done

- CSS/JS/image/inline-requires optimizers are Rust-backed:
  - Rust plugin crates implement the optimization logic.
  - JS optimizer plugins delegate to Rust when the Rust engine is enabled.
  - Golden tests verify outputs (code, assets, and sourcemaps) match JS baselines or documented tolerances.
- JS-only optimizers have a clear strategy:
  - For cssnano/htmlnano/terser/svgo/etc., behavior is either:
    - Replaced by Rust-native equivalents, or
    - Kept as JS adapters invoked through a stable plugin RPC contract.
  - Each such optimizer has documented status (Rust-native, JS adapter, deprecated) and tests for maintained behavior.
- Optimizer parity suite exists:
  - Per-optimizer fixtures and goldens live under `__fixtures__/plugin-parity/<plugin>/`.
  - CI enforces parity on JS baselines, and dual-run is used to monitor Rust behavior where applicable.

## Before merge (checklist)

- [ ] Run Epic 0 baseline commands.
- [ ] Extend plugin parity tests to cover optimizers and run `yarn test:js:unit --grep "plugin parity"`.
- [ ] Add or verify optimizer-specific fixtures under `packages/core/core/test/__fixtures__/plugin-parity/<plugin>/`.
- [ ] Confirm determinism (rerun tests, no unexpected golden drift) and document allowed deltas (e.g. non-semantic formatting differences).
- [ ] Document the status (Rust-native / JS adapter / deprecated) for each optimizer in the plugin inventory.
