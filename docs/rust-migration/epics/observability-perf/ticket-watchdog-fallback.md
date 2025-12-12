# Ticket: Watchdog and JS Fallback

## Objective

Add panic/timeout watchdog to Rust engine with automatic JS fallback and user-visible notice.

## Tasks

- Implement watchdog around critical sections/FFI; detect hangs/timeouts/panics.
- On fatal error, fall back to JS engine with a clear diagnostic and telemetry event.
- Add chaos/fault injection tests to exercise fallback path; ensure no partial cache corruption.
- Emit fallback events in telemetry JSON/JSONL for integration to aggregate; no alerting wiring in this repo.

## Acceptance Criteria

- Fault-injection tests trigger fallback reliably; diagnostics explain switch to JS.
- Cache and state remain valid after fallback; no silent corruption.
- Telemetry includes reason codes for fallback events in exported logs.
