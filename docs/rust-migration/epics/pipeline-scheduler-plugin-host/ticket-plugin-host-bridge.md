# Ticket: JS Plugin Host Bridge

## Objective

Provide a stable bridge to run existing JS plugins from the Rust pipeline with lifecycle hooks, streaming payloads, cancellation, and backpressure.

## Tasks

- Choose transport (Node RPC vs embedded runtime) and define message protocol (requests, responses, errors, cancellation, streaming chunks).
- Implement backpressure and timeouts to prevent deadlocks; surface structured errors to Rust.
- Support plugin lifecycle hooks (load, config, transform/package/optimize/report) with consistent signatures.
- Add soak tests under load and failure modes (timeouts, cancellations, large payloads).

## Acceptance Criteria

- JS plugins execute via bridge with no code changes on fixture set.
- Backpressure/timeout handling verified in tests; no hangs under load.
- Errors are structured, typed, and mapped to diagnostics; logs captured with ordering tolerance.
