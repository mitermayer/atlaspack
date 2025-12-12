# Ticket: Diagnostics and Error Parity

## Objective

Match JS diagnostics (codes, messages, hints, file/loc) when running under the Rust orchestrator.

## Tasks

- Normalize diagnostic format between engines; ensure codes and categories align.
- Add fixture-based comparisons for common error cases (syntax errors, missing deps, config errors, transformer errors).
- Ensure stack/source locations and code frames are consistent; handle path normalization.
- Provide guardrails for log ordering tolerance while preserving message content.
- Document commands/paths for diagnostic parity tests so integration CI can run them.

## Acceptance Criteria

- Dual-run harness shows no diagnostic mismatches on fixture suite (within ordering tolerance).
- Codes/messages/locations match documented expectations; code frames render correctly.
- Regression tests added for representative error cases.
