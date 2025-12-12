# Ticket: Rust Pipeline Scheduler

## Objective

Implement pipeline scheduling in Rust covering resolver → transformers → bundler → namer → packager → optimizer → compressor with deterministic ordering.

## Tasks

- Model pipeline stages and dependencies in Rust; reuse worker pooling where available.
- Preserve stage ordering semantics from JS (including dev/prod differences like scope hoisting).
- Add tracing for stage timings; expose summaries to harness/telemetry.
- Validate outputs vs JS across fixture categories; feed results into dual-run harness.

## Acceptance Criteria

- Deterministic stage order and outputs on fixture suite; dual-run shows no stage-level drift.
- Timing metrics emitted per stage; optional perf logging without affecting determinism; outputs consumable by integration CI (JSON/JSONL).
- Scheduler configurable for smoke vs full runs (parallelism, timeouts).
