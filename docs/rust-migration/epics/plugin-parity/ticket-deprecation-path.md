# Ticket: Deprecation Path for Unsupported JS Internals

## Objective

Define and communicate deprecation for plugins relying on unsupported JS internals once Rust orchestrator is default.

## Tasks

- Identify unsupported/internal JS APIs used by plugins; propose Rust-compatible alternatives.
- Draft deprecation notice with timelines, migration steps, and fallback guidance.
- Provide lint/check to flag unsupported API usage where feasible.

## Acceptance Criteria

- Deprecation guidance published and linked from migration docs.
- Alternatives or shims provided where possible; timelines explicit.
- Optional lint/check warns on unsupported API usage.
