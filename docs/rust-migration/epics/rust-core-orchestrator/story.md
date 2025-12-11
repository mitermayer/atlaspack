# Story: Rust Core Orchestrator

## Goal

Move request tracking, graph orchestration, and task scheduling into Rust with deterministic behavior and parity to the JS engine.

## Scope

- RequestTracker/task scheduler in Rust with opaque handles exposed to JS shim.
- AssetGraph/BundleGraph orchestration and serialization in Rust.
- Cache integration (LMDB) with versioned keys, detection, and auto-invalidate/migrate flow.
- Diagnostic propagation parity (codes, hints, locations).

## Acceptance Criteria

- Graph shape/ID parity on curated fixtures; golden snapshots stored.
- Deterministic task ordering verified by property tests; no nondeterministic rebuilds.
- Cache mismatch detection with safe fallback; schema version documented.
- Diagnostics match JS on fixture set (codes/messages/locations) within tolerance.

## Links

- Epic: `docs/rust-migration/epics.md#epic-rust-core-orchestrator`
- Requirements: `docs/rust-migration/requirements.md`
- PRD: `docs/rust-migration/prd.md`
