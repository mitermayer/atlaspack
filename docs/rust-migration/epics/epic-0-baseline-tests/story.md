# Story: Epic 0 — JS Baseline Test Scaffolding

## Goal

Create the initial JS-engine baseline test scaffolding and fixtures that other epics will build on. All new tests must pass on the existing JS path and generate goldens/artifacts consumable by integration CI.

## Scope

- Establish common fixtures, normalization utilities, and snapshot storage for parity tests.
- Add initial high-value baseline tests in two areas: (1) dual-run harness smoke, (2) core request/invalidation parity.
- Document commands/paths for integration CI to consume; no CI wiring in this repo.

## Acceptance Criteria

- Shared test utilities for normalization (paths, timestamps, hashes) and artifact writing are available to all suites.
- At least one dual-run smoke test (small fixture) passing on JS engine, emitting `summary.json` in predictable path.
- At least one core request/invalidation parity test passing on JS engine with a stable snapshot.
- Commands/paths documented for integration to invoke these tests; failures exit non-zero.

## Links

- Testing plan: `docs/rust-migration/testing-plan.md`
- Parity epic: `docs/rust-migration/epics/parity-dual-run/`
- Core orchestrator epic: `docs/rust-migration/epics/rust-core-orchestrator/`
