# Ticket: Plugin Golden Tests

## Objective

Create and enforce golden tests for each supported plugin under the Rust orchestrator.

## Tasks

- For each plugin, define inputs and expected outputs/diagnostics/metadata.
- Store goldens and add runnable tests (smoke + full) with tolerances per plugin; expose commands/paths so integration CI can consume these tests.
- Document update process and review requirements for golden changes.

## Acceptance Criteria

- All supported plugins covered by golden tests; unexpected diffs cause test failures when run (integration CI can enforce).
- Goldens reproducible; update process documented and reviewed.
- Diagnostics and metadata validated, not just file contents; commands/paths for integration CI are documented.
