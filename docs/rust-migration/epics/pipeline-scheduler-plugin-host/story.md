# Story: Pipeline Scheduler and Plugin Hosting

## Goal

Run the full resolver→transformer→bundler→namer→packager→optimizer→compressor pipeline from Rust, while supporting existing JS plugins via a stable host bridge.

## Scope

- Rust scheduler orchestrating pipeline stages and workers.
- JS plugin host bridge (RPC/embed) with lifecycle hooks, streaming, cancellation/backpressure.
- Contract/IDL for plugin calls with versioning and compatibility checks.
- Per-plugin-category contract tests against golden outputs.

## Acceptance Criteria

- Rust-driven pipeline produces parity outputs on fixtures; JS plugins run via bridge unchanged.
- ABI/IDL documented and versioned; compatibility checks enforced at load time.
- Contract tests per plugin category passing in CI; failures actionable with diffs.

## Links

- Epic: `docs/rust-migration/epics.md#epic-pipeline-scheduler-and-plugin-hosting`
- Requirements: `docs/rust-migration/requirements.md`
- PRD: `docs/rust-migration/prd.md`
