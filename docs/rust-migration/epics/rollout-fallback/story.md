# Story: Rollout and Fallback

## Goal

Plan and execute a staged rollout of the Rust engine with safe toggles, user guidance, and rollback procedures.

## Scope

- Feature flag plumbing and matrix testing.
- Opt-in/out documentation and CLI help.
- Rollout playbook with exit/rollback criteria across dogfood, beta, default-on, and JS removal phases.

## Acceptance Criteria

- Flags work across CLI/env/CI; matrix tests cover combinations.
- Docs clearly explain enabling/disabling, expected diffs, and fallback behavior.
- Playbook defines owners, dates, gates, rollback steps, and monitoring signals.

## Links

- Epic: `docs/rust-migration/epics.md#epic-rollout-and-fallback`
- Requirements: `docs/rust-migration/requirements.md`
- PRD: `docs/rust-migration/prd.md`
