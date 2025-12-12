# Story: Observability and Performance

## Goal

Instrument the Rust engine and dual-run harness with metrics and enforce performance guardrails without sacrificing determinism.

## Scope

- Metrics spans around FFI, scheduler stages, cache hits/misses, watch latency.
- Perf measurements and budgets emitted as JSON/JSONL for integration CI to enforce; no dashboard/CI wiring in this repo.
- Panic/timeout watchdog with JS fallback and user-visible notice.

## Acceptance Criteria

- Metrics export available with stable schema; sampling documented; integration can ingest to dashboards.
- Perf measurements (cold/warm/memory) emitted with budgets documented; smoke/full sets identified for downstream scheduling.
- Watchdog exercised in tests; fallback path works and logs appropriately.

## Links

- Epic: `docs/rust-migration/epics.md#epic-observability-and-perf`
- Requirements: `docs/rust-migration/requirements.md`
- PRD: `docs/rust-migration/prd.md`
