# Ticket: Parity Artifacts and Telemetry Contract (Integration CI Owned)

## Objective

Ensure the dual-run harness emits deterministic artifacts and telemetry that integration-owned CI can consume. CI wiring and alerting are out of scope for this project.

## Tasks

- Define artifact layout: `.parcel-cache/parity/<engine>/<fixture>/` containing bundles, graphs, diagnostics, source maps, and a `summary.json` with status, hashes, diffs, timings, memory (if available).
- Document schema for `summary.json` (fields, types, units) and any tolerance rules applied during diffing.
- Provide optional JSONL stream for per-fixture events/metrics; ensure stable field names for downstream ingestion.
- Document how to invoke dual-run locally with flags/env and where artifacts are written.

## Acceptance Criteria

- Dual-run writes artifacts and `summary.json` per fixture with a stable schema; exits non-zero on diffs.
- Tolerance rules and normalization steps are documented alongside the schema.
- Instructions for running locally and interpreting artifacts are published; no CI job changes required in this repo.
