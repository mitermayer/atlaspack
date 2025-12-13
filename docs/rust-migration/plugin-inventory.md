# Atlaspack Plugin Inventory & Migration Status

This document tracks all Atlaspack plugins and their migration status toward Rust-backed implementations. It is the source of truth for:

- Which plugins are **Rust-native** or **Rust-backed** under the Rust engine.
- Which plugins remain **JS-only** (and why).
- Where new Rust plugin crates are required.
- How this work maps to the plugin migration epics.

Status values are intended to align with the following epics:

- **Epic: Plugin Migration – Core Engine Plugins**
- **Epic: Plugin Migration – Optimizers & Compressors**
- **Epic: Plugin Migration – Runtimes, Reporters & Ecosystem Adapters**

## Legend

- **Status**
  - `Rust-native (wired)`: Implemented as a Rust plugin crate and used by the Rust engine; JS plugin acts as public entrypoint.
  - `Rust-native (planned)`: Rust crate not yet implemented or wired; migration planned.
  - `JS adapter`: Plugin is JS-based but will remain as a thin adapter over Rust or external tools.
  - `JS-only (consider deprecate)`: Plugin has no Rust path and is a candidate for deprecation or replacement.
- **Rust crate**
  - Name of the corresponding Rust crate if one exists or is planned.
- **Epic**
  - Primary epic responsible for migration work.

---

## 1. Transformers

Core and ecosystem transformers under `packages/transformers/*`.

### 1.1 Core transformers (have Rust crates)

These transformers already have Rust plugin crates and plugin parity tests.

| JS Plugin Path                        | Rust Crate                                          | Status              | Epic                | Notes                                             |
| ------------------------------------- | --------------------------------------------------- | ------------------- | ------------------- | ------------------------------------------------- |
| `packages/transformers/css`           | `crates/atlaspack_plugin_transformer_css`           | Rust-native (wired) | Core Engine Plugins | Covered by plugin-parity tests.                   |
| `packages/transformers/html`          | `crates/atlaspack_plugin_transformer_html`          | Rust-native (wired) | Core Engine Plugins | HTML parsing/transform in Rust.                   |
| `packages/transformers/js`            | `crates/atlaspack_plugin_transformer_js`            | Rust-native (wired) | Core Engine Plugins | SWC-based JS/TS transformer.                      |
| `packages/transformers/json`          | `crates/atlaspack_plugin_transformer_json`          | Rust-native (wired) | Core Engine Plugins | JSON transform and dependency collection.         |
| `packages/transformers/raw`           | `crates/atlaspack_plugin_transformer_raw`           | Rust-native (wired) | Core Engine Plugins | Raw assets (no transform).                        |
| `packages/transformers/svg`           | `crates/atlaspack_plugin_transformer_svg`           | Rust-native (wired) | Core Engine Plugins | SVG transform and metadata.                       |
| `packages/transformers/image`         | `crates/atlaspack_plugin_transformer_image`         | Rust-native (wired) | Core Engine Plugins | Image optimization and transformation.            |
| `packages/transformers/inline`        | `crates/atlaspack_plugin_transformer_inline`        | Rust-native (wired) | Core Engine Plugins | Inline assets transformer.                        |
| `packages/transformers/inline-string` | `crates/atlaspack_plugin_transformer_inline_string` | Rust-native (wired) | Core Engine Plugins | Inline string transformer.                        |
| `packages/transformers/tokens`        | `crates/atlaspack_plugin_transformer_tokens`        | Rust-native (wired) | Core Engine Plugins | Token transformer; migration flag already exists. |
| `packages/transformers/yaml`          | `crates/atlaspack_plugin_transformer_yaml`          | Rust-native (wired) | Core Engine Plugins | YAML → JS/JSON transform.                         |

### 1.2 Other transformers (ecosystem / niche)

These do not currently have dedicated Rust plugin crates. Many are wrappers around external JS ecosystems (Babel, PostCSS, MDX, etc.) or niche formats.

| JS Plugin Path                             | Rust Crate (planned?)         | Status                       | Epic                                         | Notes                                                                             |
| ------------------------------------------ | ----------------------------- | ---------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/transformers/babel`              | _none (JS ecosystem adapter)_ | JS adapter                   | Runtimes/Adapters                            | Babel-based transform; likely to remain JS adapter over SWC where needed.         |
| `packages/transformers/compiled-css-in-js` | _none_                        | JS adapter                   | Optimizers & Compressors / Runtimes/Adapters | Bridges compiled CSS-in-JS; backed by SWC + Rust CSS where possible.              |
| `packages/transformers/glsl`               | _none_                        | JS-only (consider deprecate) | Core Engine Plugins / Runtimes/Adapters      | GLSL shader transform; usage should be audited.                                   |
| `packages/transformers/graphql`            | _none_                        | JS adapter                   | Runtimes/Adapters                            | GraphQL transform; typically low volume.                                          |
| `packages/transformers/jsonld`             | _none_                        | JS adapter                   | Runtimes/Adapters                            | JSON-LD, niche.                                                                   |
| `packages/transformers/less`               | _none_                        | JS adapter                   | Runtimes/Adapters                            | Tied to Less JS tooling.                                                          |
| `packages/transformers/mdx`                | _none_                        | JS adapter                   | Runtimes/Adapters                            | MDX; likely SWC-friendly in future.                                               |
| `packages/transformers/postcss`            | _none_                        | JS adapter                   | Optimizers & Compressors / Runtimes/Adapters | Uses PostCSS ecosystem; candidate for partial Rust replacement via Lightning CSS. |
| `packages/transformers/posthtml`           | _none_                        | JS adapter                   | Runtimes/Adapters                            | PostHTML-based transforms.                                                        |
| `packages/transformers/pug`                | _none_                        | JS adapter                   | Runtimes/Adapters                            | Template engine; unlikely to be Rust-native.                                      |
| `packages/transformers/react-refresh-wrap` | _none_                        | JS adapter                   | Runtimes/Adapters                            | Wraps React Refresh logic.                                                        |
| `packages/transformers/sass`               | _none_                        | JS adapter                   | Runtimes/Adapters                            | Sass/SCSS; likely to continue via JS tooling or Rust sass if adopted.             |
| `packages/transformers/svg-react`          | _none_                        | JS adapter                   | Runtimes/Adapters                            | SVG to React component; low priority for Rust.                                    |
| `packages/transformers/toml`               | _none_                        | JS adapter                   | Runtimes/Adapters                            | TOML parsing; potential Rust crate later.                                         |
| `packages/transformers/typescript-tsc`     | _none_                        | JS adapter                   | Runtimes/Adapters                            | Uses TypeScript compiler; SWC should cover most use-cases.                        |
| `packages/transformers/typescript-types`   | _none_                        | JS adapter                   | Runtimes/Adapters                            | Type-only transforms.                                                             |
| `packages/transformers/webextension`       | _none_                        | JS adapter                   | Core Engine Plugins / Runtimes/Adapters      | Schema/manifest transforms, tied to packagers & runtimes.                         |
| `packages/transformers/webmanifest`        | _none_                        | JS adapter                   | Core Engine Plugins / Runtimes/Adapters      | Manifest transform, low perf impact.                                              |
| `packages/transformers/worklet`            | _none_                        | JS adapter                   | Runtimes/Adapters                            | Specialized for CSS/JS worklets; audit usage.                                     |
| `packages/transformers/xml`                | _none_                        | JS adapter                   | Core Engine Plugins                          | XML parsing; potential Rust crate, low priority.                                  |

---

## 2. Resolvers

| JS Plugin Path                 | Rust Crate                         | Status              | Epic                | Notes                                                                    |
| ------------------------------ | ---------------------------------- | ------------------- | ------------------- | ------------------------------------------------------------------------ |
| `packages/resolvers/default`   | `crates/atlaspack_plugin_resolver` | Rust-native (wired) | Core Engine Plugins | Default module resolver; parity tests and Rust engine integration exist. |
| `packages/resolvers/glob`      | _none_                             | JS adapter          | Core Engine Plugins | Glob resolution; can remain JS adapter or gain Rust crate if needed.     |
| `packages/resolvers/tesseract` | _none_                             | JS adapter          | Core Engine Plugins | Specialized resolver; usage to be audited.                               |

---

## 3. Bundlers, Packagers, Namers

Currently JS-only; Rust crates to be introduced as part of the core plugin migration epic.

### 3.1 Bundlers

| JS Plugin Path                           | Rust Crate (planned)                                   | Status                | Epic                | Notes                                                            |
| ---------------------------------------- | ------------------------------------------------------ | --------------------- | ------------------- | ---------------------------------------------------------------- |
| `packages/bundlers/default`              | `crates/atlaspack_plugin_bundler_default`              | Rust-native (planned) | Core Engine Plugins | Default bundler; should encode documented bundle graph behavior. |
| `packages/bundlers/library`              | `crates/atlaspack_plugin_bundler_library`              | Rust-native (planned) | Core Engine Plugins | Library bundling behavior; follows DefaultBundler docs.          |
| `packages/bundlers/bundler-experimental` | `crates/atlaspack_plugin_bundler_experimental` (maybe) | JS adapter / planned  | Core Engine Plugins | Experimental strategies; migration depends on stability.         |

### 3.2 Packagers

| JS Plugin Path                    | Rust Crate (planned)                            | Status                | Epic                | Notes                                                               |
| --------------------------------- | ----------------------------------------------- | --------------------- | ------------------- | ------------------------------------------------------------------- |
| `packages/packagers/css`          | `crates/atlaspack_plugin_packager_css`          | Rust-native (planned) | Core Engine Plugins | Emits CSS bundles and sourcemaps.                                   |
| `packages/packagers/html`         | `crates/atlaspack_plugin_packager_html`         | Rust-native (planned) | Core Engine Plugins | Emits HTML bundles.                                                 |
| `packages/packagers/js`           | `crates/atlaspack_plugin_packager_js`           | Rust-native (planned) | Core Engine Plugins | JS packager; critical for scope hoisting pipeline.                  |
| `packages/packagers/raw`          | `crates/atlaspack_plugin_packager_raw`          | Rust-native (planned) | Core Engine Plugins | Raw asset packager.                                                 |
| `packages/packagers/raw-url`      | `crates/atlaspack_plugin_packager_raw_url`      | Rust-native (planned) | Core Engine Plugins | Emits URL-based references; low complexity.                         |
| `packages/packagers/svg`          | `crates/atlaspack_plugin_packager_svg`          | Rust-native (planned) | Core Engine Plugins | SVG packaging, aligns with SVG transformer.                         |
| `packages/packagers/ts`           | `crates/atlaspack_plugin_packager_ts`           | Rust-native (planned) | Core Engine Plugins | TypeScript declaration packager; might remain JS adapter initially. |
| `packages/packagers/wasm`         | `crates/atlaspack_plugin_packager_wasm`         | Rust-native (planned) | Core Engine Plugins | WASM packaging; requires careful ABI handling.                      |
| `packages/packagers/webextension` | `crates/atlaspack_plugin_packager_webextension` | Rust-native (planned) | Core Engine Plugins | WebExtension bundle packaging.                                      |
| `packages/packagers/xml`          | `crates/atlaspack_plugin_packager_xml`          | Rust-native (planned) | Core Engine Plugins | XML packaging; lower priority.                                      |

### 3.3 Namers

| JS Plugin Path            | Rust Crate (planned)                    | Status                | Epic                | Notes                                                          |
| ------------------------- | --------------------------------------- | --------------------- | ------------------- | -------------------------------------------------------------- |
| `packages/namers/default` | `crates/atlaspack_plugin_namer_default` | Rust-native (planned) | Core Engine Plugins | Default naming scheme; must match existing JS output patterns. |

---

## 4. Optimizers & Compressors

### 4.1 Optimizers with clear Rust paths

| JS Plugin Path                        | Rust Crate                                             | Status                | Epic                     | Notes                                                        |
| ------------------------------------- | ------------------------------------------------------ | --------------------- | ------------------------ | ------------------------------------------------------------ |
| `packages/optimizers/inline-requires` | `crates/atlaspack_plugin_optimizer_inline_requires`    | Rust-native (wired)   | Optimizers & Compressors | Already has Rust crate; ensure plugin parity tests cover it. |
| `packages/optimizers/css`             | `crates/atlaspack_plugin_optimizer_css` (planned)      | Rust-native (planned) | Optimizers & Compressors | Likely backed by Lightning CSS in Rust.                      |
| `packages/optimizers/swc`             | `crates/atlaspack_plugin_optimizer_js` (planned)       | Rust-native (planned) | Optimizers & Compressors | JS minification via SWC-based Rust tooling.                  |
| `packages/optimizers/image`           | `crates/atlaspack_plugin_optimizer_image` (planned)    | Rust-native (planned) | Optimizers & Compressors | Image optimization in Rust.                                  |
| `packages/optimizers/blob-url`        | `crates/atlaspack_plugin_optimizer_blob_url` (planned) | Rust-native (planned) | Optimizers & Compressors | Simple data transform; easy Rust port.                       |
| `packages/optimizers/data-url`        | `crates/atlaspack_plugin_optimizer_data_url` (planned) | Rust-native (planned) | Optimizers & Compressors | Simple transform; easy Rust port.                            |

### 4.2 JS-only optimizers (ecosystem tools)

| JS Plugin Path                 | Rust Crate | Status     | Epic                     | Notes                                                                 |
| ------------------------------ | ---------- | ---------- | ------------------------ | --------------------------------------------------------------------- |
| `packages/optimizers/cssnano`  | _none_     | JS adapter | Optimizers & Compressors | Uses cssnano; candidate to be replaced by Rust CSS where feasible.    |
| `packages/optimizers/htmlnano` | _none_     | JS adapter | Optimizers & Compressors | HTML minification via htmlnano; may remain JS adapter or be replaced. |
| `packages/optimizers/svgo`     | _none_     | JS adapter | Optimizers & Compressors | SVG optimization via SVGO.                                            |
| `packages/optimizers/terser`   | _none_     | JS adapter | Optimizers & Compressors | JS minification via terser; plan to prefer SWC-based Rust optimizer.  |

---

## 5. Reporters

Most reporters are inherently JS/Node-side UX components. Migration focuses on ensuring their inputs (events, diagnostics, telemetry) are consistent between JS and Rust engines.

| JS Plugin Path                                        | Rust Crate | Status     | Epic              | Notes                                                   |
| ----------------------------------------------------- | ---------- | ---------- | ----------------- | ------------------------------------------------------- |
| `packages/reporters/cli`                              | _none_     | JS adapter | Runtimes/Adapters | CLI reporter; consumes build events from either engine. |
| `packages/reporters/dev-server`                       | _none_     | JS adapter | Runtimes/Adapters | Dev server reporter; HMR-aware.                         |
| `packages/reporters/dev-server-sw`                    | _none_     | JS adapter | Runtimes/Adapters | Service worker dev server reporter.                     |
| `packages/reporters/json`                             | _none_     | JS adapter | Runtimes/Adapters | JSON reporter; could be used for Rust parity logs.      |
| `packages/reporters/lsp-reporter`                     | _none_     | JS adapter | Runtimes/Adapters | LSP integration.                                        |
| `packages/reporters/sourcemap-visualiser`             | _none_     | JS adapter | Runtimes/Adapters | Sourcemap visualization.                                |
| `packages/reporters/tracer`                           | _none_     | JS adapter | Runtimes/Adapters | Works with `@atlaspack/profiler` and Rust telemetry.    |
| `packages/reporters/bundle-analyzer`                  | _none_     | JS adapter | Runtimes/Adapters | Bundle analysis UI.                                     |
| `packages/reporters/bundle-buddy`                     | _none_     | JS adapter | Runtimes/Adapters | Bundle buddy integration.                               |
| `packages/reporters/bundle-stats`                     | _none_     | JS adapter | Runtimes/Adapters | Stats reporter.                                         |
| `packages/reporters/build-metrics`                    | _none_     | JS adapter | Runtimes/Adapters | Build metrics; important for Rust perf.                 |
| `packages/reporters/conditional-manifest`             | _none_     | JS adapter | Runtimes/Adapters | Conditional bundling manifest.                          |
| `packages/reporters/compiled-css-in-js-migration-map` | _none_     | JS adapter | Runtimes/Adapters | Migration helper reporter.                              |

There are no dedicated Rust reporter crates today; the focus is making reporters engine-agnostic consumers of events/telemetry produced by JS and Rust.

---

## 6. Runtimes

Runtimes are JS bundles injected into output bundles; they will likely remain JS, but must be fully compatible with the Rust engine’s view of the bundle graph and HMR state.

| JS Plugin Path                     | Rust Crate | Status     | Epic              | Notes                                                           |
| ---------------------------------- | ---------- | ---------- | ----------------- | --------------------------------------------------------------- |
| `packages/runtimes/js`             | _none_     | JS adapter | Runtimes/Adapters | Core runtime loader; must work with Rust bundle graph metadata. |
| `packages/runtimes/hmr`            | _none_     | JS adapter | Runtimes/Adapters | HMR runtime; validated via watch/HMR tests.                     |
| `packages/runtimes/react-refresh`  | _none_     | JS adapter | Runtimes/Adapters | React Refresh runtime.                                          |
| `packages/runtimes/service-worker` | _none_     | JS adapter | Runtimes/Adapters | Service worker runtime.                                         |
| `packages/runtimes/webextension`   | _none_     | JS adapter | Runtimes/Adapters | WebExtension runtime.                                           |

---

## 7. How to Use This Inventory

- When working on **Epic: Plugin Migration – Core Engine Plugins**:
  - Focus on rows marked `Rust-native (wired)` and `Rust-native (planned)` for **core transformers, resolver, bundlers, packagers, and namers**.
  - Ensure plugin parity tests and bundle/naming goldens are updated as Rust crates are wired.

- For **Epic: Plugin Migration – Optimizers & Compressors**:
  - Treat `inline-requires` as the first Rust-backed optimizer.
  - Implement and wire planned Rust optimizers (CSS/JS/image/blob-url/data-url) and decide the long-term fate of cssnano/htmlnano/terser/svgo.

- For **Epic: Plugin Migration – Runtimes, Reporters & Ecosystem Adapters**:
  - Use this inventory to decide which ecosystem adapters remain JS-only and require clear, documented contracts.
  - Ensure reporters and runtimes are thoroughly tested under both JS and Rust engines.

This file should be kept up to date as new Rust crates are added, JS plugins are retired, or statuses change. Each epic’s README should refer back here as the authoritative list of what remains to be migrated.
