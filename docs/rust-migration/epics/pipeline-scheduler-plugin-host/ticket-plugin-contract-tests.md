# Ticket: Plugin Contract Tests

## Objective

Enforce per-plugin-category contracts with golden outputs for JS and Rust plugins under the Rust scheduler.

## Tasks

- Define expected inputs/outputs/diagnostics per category (transformer, resolver, packager, optimizer, reporter).
- Build golden fixtures and outputs; store alongside tests for reproducibility.
- Wire contract tests into CI (smoke + full); integrate with dual-run diffing where applicable.
- Document how to update goldens and tolerances; require review for changes.

## Acceptance Criteria

- Contract tests green in CI for all supported plugins; failures show precise diffs.
- Goldens versioned and reproducible; update process documented.
- New plugins must supply contract coverage to merge.
