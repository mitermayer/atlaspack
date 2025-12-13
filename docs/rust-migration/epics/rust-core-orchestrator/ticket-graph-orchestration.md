# Ticket: Asset/Bundle Graph Orchestration in Rust

## Objective

Host AssetGraph and BundleGraph orchestration in Rust, preserving shapes, IDs, and serialization parity with JS.

## Tasks

- [x] Implement graph builders and mutations in Rust mirroring JS semantics (nodes/edges/ids).
- [x] Add canonical serialization for graphs to JSON for parity diffing.
- [x] Implement Reachability Analysis for Ideal Graph (Step 1 of bundling).
- [x] Implement Availability Propagation (Step 2 of bundling).
- [x] Implement Insert/Share Logic (Step 3 of bundling).
- [x] Implement Decorate Legacy Graph (Step 4 of bundling).
- [x] Wire up full pipeline in `DefaultBundler::bundle`.
- [ ] Provide JS shim bindings to query graph shape where needed.
- [ ] Document commands/paths for graph parity tests so integration CI can run them.

## Acceptance Criteria

- Graph diffs clean across fixtures (node/edge counts, IDs, labels).
- Serialization stable and consumed by dual-run harness; tests fail on drift (integration CI can enforce).
- Shim API covers existing JS consumers without widening surface area.
