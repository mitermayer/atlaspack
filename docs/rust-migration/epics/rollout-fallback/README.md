# Rollout & Fallback — Start Here

Focus on flag precedence, CLI/env overrides, and fallback messaging. Integration handles CI wiring.

## Key paths

- Tests: `packages/configs/default/test/featureFlags.test.ts`, `packages/core/core/test/integration/rollout-fallback.test.ts`.
- Fixtures: `packages/configs/default/test/__fixtures__/flags/*.json`.

## Commands

- Flags: `yarn test:js:unit --grep "feature flag"`
- Rollout/fallback integration: `yarn test:js:unit --grep "rollout fallback"`

## Definition of done

- Flag precedence matrix covered; JS behavior intact.
- Fallback messaging and dual-run entry behavior tested on JS.
- Commands documented for integration CI.

## Before merge (checklist)

- [ ] Run Epic 0 baseline commands
- [ ] Run flag/rollout tests: `yarn test:js:unit --grep "feature flag"` and `--grep "rollout fallback"`
- [ ] Verify flag fixture outputs `packages/configs/default/test/__fixtures__/flags/`
- [ ] Confirm determinism (rerun, no fixture changes)
