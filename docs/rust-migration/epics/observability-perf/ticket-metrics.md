# Ticket: Metrics and Dashboards

## Objective

Emit structured metrics for Rust engine and dual-run harness and surface them on dashboards.

## Tasks

- Add spans/counters for FFI latency, scheduler stages, cache hits/misses, watch latency, bundle counts.
- Normalize labels (engine=js|rust, fixture, stage) for comparison.
- Export metrics in CI and local runs; wire to dashboards; document sampling.

## Acceptance Criteria

- Metrics visible on shared dashboards with per-engine filters.
- Overhead negligible (sampling configurable); no determinism impact.
- Docs describe how to enable/inspect metrics locally and in CI artifacts.
