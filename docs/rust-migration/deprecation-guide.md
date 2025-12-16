# Atlaspack Rust Migration: Deprecation Guide

**Last Updated:** 2025-12-16

As Atlaspack migrates its core engine to Rust, certain legacy JavaScript APIs and internal behaviors will be deprecated. This guide outlines the timeline, affected areas, and recommended migration paths for plugin authors and users.

## Timeline

The migration follows a phased rollout:

1.  **Phase 1: Dual Run (Current)**
    - JS engine is primary. Rust engine runs in background.
    - Deprecation warnings will be logged for usage of incompatible APIs.
    - Plugins should begin migration to Rust-compatible patterns.

2.  **Phase 2: Rust Default**
    - Rust engine is primary.
    - Incompatible APIs may throw errors or return mock data.
    - Legacy plugins must use the "Host Bridge" adapter or be fully ported.

3.  **Phase 3: Cleanup**
    - Pure JS implementation of the orchestrator is removed.
    - Incompatible APIs are permanently removed.

## Deprecation Policy

### 1. Internal State Access

**Affected:** Plugins accessing `_` prefixed properties on `Asset`, `Bundle`, `BundleGraph`, or `Config`.
**Reason:** The Rust engine uses a different internal memory layout. The JS objects exposed to plugins are proxies or snapshots.
**Action:** Use only documented public APIs. If a feature is missing, open a feature request.

### 2. Deep AST Access

**Affected:** Plugins assuming `asset.ast` is a mutable JS object for all asset types without checking `asset.type`.
**Reason:** Rust transformers may pass ASTs as pointers or serialized buffers.
**Action:** Use `asset.getAST()` and `asset.setAST()`. Ensure you handle the specific AST version/type your plugin supports.

### 3. Non-Serializable Config

**Affected:** Plugins putting functions or complex class instances into the cache or config.
**Reason:** All data crossing the JS <-> Rust boundary must be serializable (structured clone compatible).
**Action:** Store only JSON-serializable data in configurations and cache entries.

## Specific Plugin Deprecations

### GLSL Transformer (`@atlaspack/transformer-glsl`)

- **Status:** Deprecated.
- **Reason:** Low usage; high maintenance cost to port to Rust.
- **Alternative:** Use `glslify` directly or a community plugin. For basic string importing, usage of `fs.readFileSync` with `@atlaspack/transformer-inline-string` is recommended.

### CSS Nano Optimizer (`@atlaspack/optimizer-cssnano`)

- **Status:** Maintenance Mode.
- **Reason:** Will be replaced by `@atlaspack/optimizer-css` (backed by Lightning CSS).
- **Alternative:** Users will be automatically migrated to the Rust-based optimizer when enabling the Rust engine.

### HTML Nano Optimizer (`@atlaspack/optimizer-htmlnano`)

- **Status:** Maintenance Mode.
- **Reason:** Will be replaced by `@atlaspack/optimizer-html` (Rust-native).
- **Alternative:** Users will be automatically migrated to the Rust-based optimizer.

## How to Check Your Plugins

Run your build with the `ATLASPACK_ strict_plugin_api=true` environment variable (planned feature) to see warnings about unsafe access.

For questions, please file an issue in the repository.
