# Ticket: Feature Flag Plumbing and Matrix Tests

## Objective

Wire feature flags for Rust engine selection and validate combinations across CLI/env/CI.

## Tasks

- Implement flags (`rust_engine_enabled`, `rust_engine_dual_run`, `rust_engine_force_js_fallback`) with CLI/env overrides.
- Add matrix tests to exercise flag combinations and ensure expected engine selection.
- Ensure defaults remain JS until rollout gate flips; provide clear error messages on bad combos.

## Acceptance Criteria

- Flags controllable via CLI/env; precedence rules documented; defaults remain JS until governance changes it.
- Invalid combos error cleanly with actionable messages.
- Matrix testing guidance documented for integration CI; no CI jobs added here.
