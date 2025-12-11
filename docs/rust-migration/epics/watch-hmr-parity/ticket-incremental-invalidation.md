# Ticket: Incremental Rebuild Invalidation Parity

## Objective

Ensure dirty-set computation and incremental rebuild behavior match the JS engine under the Rust orchestrator.

## Tasks

- Compare invalidation sets on scripted edit sequences (content change, new file, delete, move, config change).
- Validate cache reuse vs recompute decisions; log decisions for debugging.
- Add regression tests that assert identical rebuild targets across engines.

## Acceptance Criteria

- Dual-run shows identical dirty sets and rebuilt assets/bundles on fixture sequences.
- No unexpected cache invalidations or missed updates; logs support debugging.
- CI test for incremental parity passes on curated edit scripts.
