# Ticket: Wire CI and Telemetry for Dual-Run Parity

## Objective

Add CI jobs and telemetry to run the dual engine harness, publish results, and alert on regressions.

## Tasks

- Add CI jobs: `parity-smoke` (PR) and `parity-full` (nightly) invoking dual-run with appropriate fixture subsets; shard if needed.
- Upload diff reports/artifacts; make them easy to inspect (e.g., CI artifacts with index HTML/JSON summary).
- Record metrics per fixture: pass/fail reason, bundle/hash/graph/diag status, cold/warm timings, memory if available.
- Add alerting thresholds for repeated parity failures or harness breakages; document how to rerun locally.

## Acceptance Criteria

- CI surfaces pass/fail with links to parity artifacts; failures block per policy.
- Smoke job runtime within budget; full job scheduled, not blocking PRs.
- Telemetry JSON lines emitted for each fixture and consumable by dashboards.
- Docs updated in `docs/rust-migration/index.md` or harness README with instructions to run/reproduce.
