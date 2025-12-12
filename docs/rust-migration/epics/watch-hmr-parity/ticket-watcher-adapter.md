# Ticket: Watcher Adapter and Debounce Parity

## Objective

Implement Rust-side watcher adapter that mirrors JS debounce and event sequencing across platforms.

## Tasks

- Integrate platform watchers with consistent debounce defaults matching JS path.
- Record/replay watch traces for representative projects; diff sequences vs JS.
- Add configuration for debounce tuning with sane defaults; document.

## Acceptance Criteria

- Trace comparisons pass on Linux/macOS (and Windows if supported) for add/change/delete edits.
- No duplicate or dropped events relative to JS baseline on fixtures.
- Debounce settings documented; regression test provided for integration CI to run.
