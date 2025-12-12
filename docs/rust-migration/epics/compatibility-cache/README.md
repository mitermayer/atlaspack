# Compatibility & Cache — Start Here

Focus on cache schema/versioning, invalidate/reuse behavior, and hash parity outputs. Integration runs CI; you provide tests and artifacts.

## Key paths

- Tests: `packages/core/core/test/cacheKeys.test.ts`, `.../integration/cache-invalidation.test.ts`.
- Fixtures: `packages/core/core/test/__fixtures__/cache/`.

## Commands

- Cache keys: `yarn test:js:unit --grep "cache"`
- Invalidation integration: `yarn test:js:unit --grep "cache invalidation"`

## Definition of done

- Schema/version documented; tests fail on unintended changes.
- Invalidate/reuse matrix passes on JS; artifacts normalized and paths documented.
- Hash-parity outputs generated with normalization; commands provided for integration CI.

## Before merge (checklist)

- [ ] Run Epic 0 baseline commands
- [ ] Run cache tests: `yarn test:js:unit --grep "cache"` and `--grep "cache invalidation"`
- [ ] Verify fixtures in `packages/core/core/test/__fixtures__/cache/`
- [ ] Confirm determinism and expected invalidate/reuse matrix
