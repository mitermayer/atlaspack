# Story: Compatibility and Cache

## Goal

Maintain cache integrity, compatibility across platforms, and provide WASM fallback where native builds are unavailable.

## Scope

- Cache key schema versioning, migration/auto-invalidate behavior.
- Hash parity tests across OS/arch/Node matrix.
- WASM fallback validation and guidance.

## Acceptance Criteria

- Schema/versioning documented; mismatches handled safely with clear messaging.
- Matrix tests cover hash parity and report tolerated differences.
- WASM path tested with functional/perf expectations documented.

## Links

- Epic: `docs/rust-migration/epics.md#epic-compatibility-and-cache`
- Requirements: `docs/rust-migration/requirements.md`
- PRD: `docs/rust-migration/prd.md`
