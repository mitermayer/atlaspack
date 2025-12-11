# Story: Plugin Parity

## Goal

Ensure all supported plugins work under the Rust orchestrator, prioritizing JS-only plugins for porting or shimming, with clear deprecation paths for unsupported internals.

## Scope

- Audit JS-only plugins and prioritize porting or shimming.
- Golden tests per plugin (diagnostics, asset metadata, outputs).
- Deprecation plan for unsupported JS internals with communicated timelines.

## Acceptance Criteria

- Tracked list of JS-only plugins with owners/ETA; risk notes captured.
- Golden tests in CI for each plugin; diffs actionable and reviewed on change.
- Deprecation guidance published; timelines and alternatives communicated.

## Links

- Epic: `docs/rust-migration/epics.md#epic-plugin-parity`
- Requirements: `docs/rust-migration/requirements.md`
- PRD: `docs/rust-migration/prd.md`
