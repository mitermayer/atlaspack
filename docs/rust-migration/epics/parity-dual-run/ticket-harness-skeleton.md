# Ticket: Implement Dual-Run Harness Skeleton

## Objective

Add `dual` engine execution that runs JS and Rust back-to-back on a fixture and writes comparable artifacts.

## Tasks

- Add CLI/env flag plumbing: `--engine=js|rust|dual`, `ATLASPACK_ENGINE`, `ATLASPACK_PARITY_SMOKE`.
- Implement runner that invokes JS engine then Rust (order configurable), capturing artifacts to `.parcel-cache/parity/<engine>/<fixture>/`.
- Normalize outputs (paths, line endings) before diffing; serialize bundle/graph/diag summaries to JSON.
- Emit summary report with per-fixture status and exit non-zero on diff failures.

## Acceptance Criteria

- Local command: `yarn atlaspack build --engine=dual <fixture>` produces parity report and artifacts for both engines.
- Diff report includes: bundle hash match/mismatch, graph structure diff, diagnostics diff summary; timings recorded.
- Single-engine fallback works when dual is unavailable (e.g., missing native binary) with a clear message.

## Notes

- Keep harness isolated; no changes to default engine behavior.
- Favor existing logging/diagnostic normalizers to minimize new drift.
