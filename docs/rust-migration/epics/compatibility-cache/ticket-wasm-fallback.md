# Ticket: WASM Fallback Validation

## Objective

Validate and document WASM fallback for environments without native builds.

## Tasks

- Build/test WASM path for node-bindings; ensure loader selects WASM when native missing.
- Run parity subset under WASM; measure functional correctness and perf expectations.
- Document supported scenarios, limitations, and recommended usage.

## Acceptance Criteria

- WASM path verified on targeted environments (integration CI can run the lane); failures actionable.
- Functional parity on smoke fixtures; perf expectations documented (may be slower).
- Loader messages clear when selecting WASM; guidance included in docs.
