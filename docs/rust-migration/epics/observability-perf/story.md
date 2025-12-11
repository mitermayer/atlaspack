# Story: Observability and Performance

## Goal

Instrument the Rust engine and dual-run harness with metrics and enforce performance guardrails without sacrificing determinism.

## Scope

- Metrics spans around FFI, scheduler stages, cache hits/misses, watch latency.
- Perf budgets and checks in CI for cold/warm timings and memory.
- Panic/timeout watchdog with JS fallback and user-visible notice.

## Acceptance Criteria

- Metrics emitted and viewable on dashboards; sampling documented.
- CI perf checks with clear thresholds and failure messages; opt-in smoke vs full.
- Watchdog exercised in tests; fallback path works and logs appropriately.

## Links

- Epic: `docs/rust-migration/epics.md#epic-observability-and-perf`
- Requirements: `docs/rust-migration/requirements.md`
- PRD: `docs/rust-migration/prd.md`
