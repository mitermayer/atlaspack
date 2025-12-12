# Ticket: Metrics and Dashboards

## Objective

Emit structured metrics for Rust engine and dual-run harness and surface them on dashboards.

## Tasks

- Add spans/counters for FFI latency, scheduler stages, cache hits/misses, watch latency, bundle counts.
- Normalize labels (engine=js|rust, fixture, stage) for comparison.
- Provide optional JSON/JSONL export alongside parity artifacts; integration can ingest to dashboards. No dashboard wiring in this repo.

## Acceptance Criteria

- Metrics export available locally/CI via JSON/JSONL with stable schema; per-engine labels included.
- Overhead negligible (sampling configurable); no determinism impact.
- Docs describe how to enable/inspect metrics locally and where exports are written for integration ingestion.
