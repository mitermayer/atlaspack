# Ticket: ABI/IDL for Plugin Calls

## Objective

Define and enforce a versioned ABI/IDL for plugin RPC between Rust scheduler and JS plugin host.

## Tasks

- Specify message shapes (requests/responses/errors/events) and serialization format.
- Implement version negotiation and compatibility checks at startup; refuse/ warn on mismatch.
- Generate schema docs; add conformance tests for encoding/decoding, large payloads, and edge cases.
- Provide migration guidelines for breaking changes.

## Acceptance Criteria

- ABI/IDL published in repo; version check enforced at runtime.
- Conformance tests pass in CI; fuzz/roundtrip tests for encoders.
- Bridge and plugins fail fast with clear errors on version mismatch.
