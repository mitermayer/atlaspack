# Ticket: CI Performance Budgets

## Objective

Enforce cold/warm timing and memory budgets for Rust vs JS in CI without excessive flakiness.

## Tasks

- Define benchmark fixture set and measurement protocol (iterations, warmups, environment normalization).
- Add CI job that measures JS and Rust engines; compute deltas vs baseline; set tolerances.
- Provide smoke (fast) and full (slow) modes; shard if needed.

## Acceptance Criteria

- CI job reports timings/memory with pass/fail per budget; clear messaging on regressions.
- Flake mitigation in place (retries or statistical thresholds); job time within budget.
- Baselines documented; updates require review.
