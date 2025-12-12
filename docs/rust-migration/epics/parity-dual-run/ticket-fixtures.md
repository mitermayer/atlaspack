# Ticket: Curate Parity Fixture Set and Tolerance Rules

## Objective

Define and maintain fixtures plus diff tolerances to exercise critical behaviors for JS vs Rust parity.

## Tasks

- Select/reuse fixtures from `packages/examples/*` and integration tests covering: scope hoist, tree shaking, dynamic import/code splitting, HMR/watch (React refresh), CSS modules/assets, JSON/YAML/raw, images/SVG/HTML packagers, tokens/inline requires.
- Add minimal new fixtures only if gaps exist; document each fixture’s intent and owner.
- Define diff tolerances: source-map path/VLQ normalization, log ordering tolerance, acceptable timestamp/path differences, optional hash ignore lists for non-deterministic assets.
- Publish fixture catalog and tolerance rules consumed by the harness (machine-readable) so integration CI can reuse directly.
- Identify smoke vs full subsets with runtime budgets for downstream scheduling; no CI wiring here.

## Acceptance Criteria

- Fixture list is machine-readable and lives with the harness; integration can consume it as-is.
- Each fixture has description, category, and expected runtime budget; smoke/full subsets documented.
- Tolerance rules documented and enforced in harness diffing; changes require review.
- No in-repo CI job additions; artifacts/metadata are sufficient for integration-owned CI.
