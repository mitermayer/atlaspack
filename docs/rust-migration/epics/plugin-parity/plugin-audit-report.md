# Plugin Audit Report

**Date:** 2025-12-16
**Status:** Completed
**Epic:** Plugin Parity

## Executive Summary

We have conducted a comprehensive audit of all plugins in the `packages/` directory. The primary finding is that the majority of core infrastructure plugins (Transformers, Resolvers, Bundlers, Packagers) already have Rust equivalents either fully wired or planned. The remaining JS-only plugins fall largely into the "Ecosystem Adapter" category, wrapping external tools like Babel, TypeScript, or ESLint, which will likely remain as JS adapters bridging to the Rust orchestrator.

## Methodology

1.  **Inventory Scan:** Scanned `packages/` for all `package.json` files to identify every plugin.
2.  **Rust Correlation:** Checked `crates/` for corresponding Rust implementations.
3.  **Categorization:** Classified each plugin into:
    - `Rust-native (wired)`: Complete and active.
    - `Rust-native (planned)`: Roadmap item.
    - `JS adapter`: Long-term JS wrapper.
    - `JS-only (consider deprecate)`: Legacy or niche.

## Findings & Recommendations

### 1. Core Plugins (High Priority)

- **Status:** Good coverage. Most core transformers (JS, CSS, HTML, Image) are wired.
- **Action:** Focus on implementing `Rust-native (planned)` items in the Bundler/Packager/Optimizer epics.

### 2. Compressors (Gap Identified)

- **Findings:** `gzip`, `brotli`, and `raw` compressors are currently JS-only.
- **Recommendation:** These are CPU-intensive and excellent candidates for Rust porting. Added to inventory as `Rust-native (planned)`.

### 3. Validators (External Tools)

- **Findings:** `typescript` and `eslint` validators wrap external binaries/libs.
- **Recommendation:** Keep as `JS adapter`. Porting `tsc` or `eslint` logic to Rust is out of scope (though SWC covers some `tsc` features).

### 4. Deprecation Candidates

- `packages/transformers/glsl`: Niche usage. Recommend deprecation or community ownership.

## Next Steps

1.  **Maintain Inventory:** The [Plugin Inventory](../../plugin-inventory.md) is now the living source of truth.
2.  **Execute Deprecation:** Publish the Deprecation Guide (see `deprecation-guide.md`) and notify users of the `glsl` status.
3.  **Migration:** Proceed with the "Optimizers & Compressors" epic to address the identified compressor gaps.
