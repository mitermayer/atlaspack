# Story: Watch and HMR Parity

## Goal

Match JS watch/incremental rebuild and HMR behavior when running the Rust orchestrator, including event ordering, debouncing, and runtime message flow.

## Scope

- File watcher adapter with debounce parity per platform.
- Incremental rebuild dirty-set computation and invalidation parity.
- HMR message ordering and runtime injections (React refresh, SW) aligned with JS.

## Acceptance Criteria

- Record/replay traces show identical event ordering vs JS on curated edits.
- Incremental rebuild outputs match JS; no spurious rebuilds or misses.
- HMR transcripts match expected sequence for scripted sessions.

## Links

- Epic: `docs/rust-migration/epics.md#epic-watchhmr-parity`
- Requirements: `docs/rust-migration/requirements.md`
- PRD: `docs/rust-migration/prd.md`
