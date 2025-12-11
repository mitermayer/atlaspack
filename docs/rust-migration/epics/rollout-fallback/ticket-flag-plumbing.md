# Ticket: Feature Flag Plumbing and Matrix Tests

## Objective

Wire feature flags for Rust engine selection and validate combinations across CLI/env/CI.

## Tasks

- Implement flags (`rust_engine_enabled`, `rust_engine_dual_run`, `rust_engine_force_js_fallback`) with CLI/env overrides.
- Add matrix tests to exercise flag combinations and ensure expected engine selection.
- Ensure defaults remain JS until rollout gate flips; provide clear error messages on bad combos.

## Acceptance Criteria

- Flag matrix tests green in CI; invalid combos error cleanly.
- Flags controllable via CLI/env; precedence rules documented.
- Default remains JS until governance gate changes it.
