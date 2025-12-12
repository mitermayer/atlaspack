# Ticket: CI Performance Budgets

## Objective

Enforce cold/warm timing and memory budgets for Rust vs JS in CI without excessive flakiness.

## Tasks

- Define benchmark fixture set and measurement protocol (iterations, warmups, environment normalization).
- Implement measurement hooks and outputs (JSON/JSONL) for timings/memory; no CI job wiring in this repo.
- Provide smoke (fast) and full (slow) fixture sets and expected runtime budgets for integration to schedule.

## Acceptance Criteria

- Measurement outputs written with stable schema and budgets documented; integration can consume and enforce.
- Flake mitigation guidance documented (iterations/warmups) though enforcement is external.
- Baselines and update rules documented; no CI job changes here.
