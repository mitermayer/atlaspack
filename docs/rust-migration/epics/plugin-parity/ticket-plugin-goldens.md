# Ticket: Plugin Golden Tests

## Objective

Create and enforce golden tests for each supported plugin under the Rust orchestrator.

## Tasks

- For each plugin, define inputs and expected outputs/diagnostics/metadata.
- Store goldens and add tests to CI (smoke + full) with tolerances per plugin.
- Document update process and review requirements for golden changes.

## Acceptance Criteria

- All supported plugins covered by golden tests; CI fails on unexpected diffs.
- Goldens reproducible; update process documented and reviewed.
- Diagnostics and metadata validated, not just file contents.
