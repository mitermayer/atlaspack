# Ticket: Cache Schema Versioning and Migration

## Objective

Document and enforce cache schema versioning with safe migration or invalidation paths.

## Tasks

- Define schema components (graphs, bundles, assets, source maps) and version fields.
- Implement detection of schema mismatch; choose migrate vs invalidate; log clearly.
- Add tests ensuring mismatches do not corrupt cache; require review on schema bumps.

## Acceptance Criteria

- Schema version documented and emitted in cache metadata.
- On mismatch, build either migrates safely or invalidates; no silent corruption.
- Guardrails/tests fail on unintended schema changes; document commands/paths for integration CI to run.
