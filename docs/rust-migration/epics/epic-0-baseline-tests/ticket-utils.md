# Ticket: Baseline Test Utilities and Normalization

## Objective

Create shared test utilities for normalization (paths, timestamps, hashes) and artifact writing for parity tests.

## Tasks

- Add a small JS helper module (e.g., `packages/core/core/test/utils/normalize.ts`) to normalize paths, strip timestamps, and stable-sort keys for JSON artifacts.
- Add an artifact writer helper to emit `summary.json` and JSONL event logs under `.parcel-cache/parity/<engine>/<fixture>/`.
- Document usage in a short README near the utils.

## Acceptance Criteria

- Helpers are imported by sample tests and keep snapshots stable across runs.
- Paths for artifacts are predictable and match the parity documentation.
- README documents functions and expected outputs.

## Command

- `yarn test:js:unit --grep "baseline utils"` (once sample test added).
