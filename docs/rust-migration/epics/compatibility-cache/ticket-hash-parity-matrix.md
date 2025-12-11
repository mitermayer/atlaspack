# Ticket: Hash Parity Matrix

## Objective

Validate bundle/asset/source-map hash parity across OS/arch/Node matrix for JS vs Rust engines.

## Tasks

- Define matrix (OS/arch/Node versions) and fixture subset for hashing.
- Automate runs and hash capture; normalize paths/line endings where appropriate.
- Report tolerated differences; fail on unexpected hash drift.

## Acceptance Criteria

- Matrix job produces hash reports per platform; unexpected drift fails CI.
- Normalization rules documented; tolerated differences reviewed/approved.
- Reports accessible from CI artifacts; developers can reproduce locally.
