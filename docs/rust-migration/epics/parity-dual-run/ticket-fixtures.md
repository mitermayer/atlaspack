# Ticket: Curate Parity Fixture Set and Tolerance Rules

## Objective

Define and maintain fixtures plus diff tolerances to exercise critical behaviors for JS vs Rust parity.

## Tasks

- Select/reuse fixtures from `packages/examples/*` and integration tests covering: scope hoist, tree shaking, dynamic import/code splitting, HMR/watch (React refresh), CSS modules/assets, JSON/YAML/raw, images/SVG/HTML packagers, tokens/inline requires.
- Add minimal new fixtures only if gaps exist; document each fixture’s intent and owner.
- Define diff tolerances: source-map path/VLQ normalization, log ordering tolerance, acceptable timestamp/path differences, optional hash ignore lists for non-deterministic assets.
- Publish fixture catalog and tolerance rules consumed by the harness.

## Acceptance Criteria

- Fixture list lives alongside harness (machine-readable) and is referenced by dual-run CI jobs.
- Each fixture has a short description, category, and expected runtime budget.
- Tolerance rules documented and enforced in the diff step; changes to rules require review.
- Smoke subset identified for PR CI (<10m); full set defined for nightly.
