# Ticket: Asset/Bundle Graph Orchestration in Rust

## Objective

Host AssetGraph and BundleGraph orchestration in Rust, preserving shapes, IDs, and serialization parity with JS.

## Tasks

- Implement graph builders and mutations in Rust mirroring JS semantics (nodes/edges/ids).
- Add canonical serialization for graphs to JSON for parity diffing.
- Golden snapshots for core fixtures; enforce parity in CI (via dual-run harness outputs).
- Provide JS shim bindings to query graph shape where needed.

## Acceptance Criteria

- Graph diffs clean across fixtures (node/edge counts, IDs, labels).
- Serialization stable and consumed by dual-run harness; CI fails on drift.
- Shim API covers existing JS consumers without widening surface area.
