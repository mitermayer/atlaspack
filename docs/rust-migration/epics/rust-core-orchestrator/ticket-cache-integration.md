# Ticket: Cache Integration and Schema Versioning

## Objective

Wire Rust orchestrator to LMDB cache with versioned keys, detection, and safe invalidate/migrate behavior.

## Tasks

- Define schema versioning for cache keys affecting graphs/assets/bundles/source maps.
- Implement detection of mismatched versions; choose auto-invalidate vs migration; log clearly.
- Ensure hash parity with JS for shared artifacts where possible; document exceptions.
- Add CI check that fails on unintended schema bumps; update PRD/requirements on intentional changes.

## Acceptance Criteria

- On version mismatch, build either migrates or invalidates cleanly with user-visible notice.
- Hash parity confirmed on fixtures where formats match; exceptions documented.
- CI guardrails prevent silent schema drift; schema version documented in repo.
