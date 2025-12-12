# Ticket: Port RequestTracker and Scheduler to Rust

## Objective

Implement RequestTracker and task scheduler in Rust with deterministic ordering and parity to the JS engine.

## Tasks

- Reimplement request graph, dependency tracking, and invalidation logic in Rust.
- Preserve deterministic ordering; add property tests comparing JS vs Rust schedules on fixtures.
- Expose opaque handles/APIs to JS shim for backwards compatibility.
- Add tracing to surface ordering/invalidation decisions for debugging.
- Provide commands/paths for record/replay tests so integration CI can run them.

## Acceptance Criteria

- Fixture suite shows identical invalidation and execution order vs JS (record/replay tests).
- JS shim can drive Rust tracker without API breaks; dual-run harness reports no order diffs.
- Tracing/logging toggleable without affecting determinism.
