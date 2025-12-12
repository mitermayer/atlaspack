# Story: Dual-Run Parity Harness

## Goal

Provide a dual-run mode that executes Atlaspack with JS and Rust engines on the same fixture set, producing deterministic diffs (bundles, graphs, diagnostics, timings) to gate rollout.

## Scope

- CLI/env flags to select `js|rust|dual` engines.
- Harness that runs both engines, captures artifacts, and diffs with tolerance rules.
- Fixture set covering core behaviors (scope hoist, HMR/watch, dynamic import, code splitting, assets, tokens, inline requires, SVG/HTML packaging).
- Reports stored under `.parcel-cache/parity/<engine>/<fixture>/` with merged diff summary per run; CI wiring handled by integration, not this project.

## Acceptance Criteria

- Dual-run executable locally with flags/env; outputs and exit codes are stable so integration CI can invoke it directly; errors include guidance to rerun single-engine fallback.
- Diffing covers bundles (hash), graphs (structural), diagnostics/logs (normalized), source maps (path/VLQ tolerance), and timings (recorded but non-blocking initially).
- Failing diffs generate actionable report (per-fixture status + reason) and exit non-zero.
- Smoke suite completes <10m locally; full suite identified for integration to run on their CI cadence.

## Dependencies

- Existing fixture content (reuse integration/examples where possible).
- Node/Rust engines built for host platform.
- Cache directory writable for artifacts.

## Links

- Epic: `docs/rust-migration/epics.md#epic-parity-baseline-and-dual-run-harness`
- Requirements: `docs/rust-migration/requirements.md`
- PRD: `docs/rust-migration/prd.md`
