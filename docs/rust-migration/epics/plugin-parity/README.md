# Plugin Parity — Start Here

Contract/golden tests per plugin, JS baseline first. Integration CI consumes commands; you provide fixtures and goldens.

## Key paths

- Tests: `packages/core/core/test/plugin-parity/*.test.ts`.
- Fixtures/goldens: `packages/core/core/test/__fixtures__/plugin-parity/<plugin>/`.

## Commands

- Plugin parity suite: `yarn test:js:unit --grep "plugin parity"`

## Definition of done

- Each supported plugin has a fixture and golden outputs/diagnostics/metadata passing on JS.
- Commands and paths documented; goldens normalized (hashes/paths/timestamps).

## Before merge (checklist)

- [ ] Run Epic 0 baseline commands
- [ ] Run plugin parity suite: `yarn test:js:unit --grep "plugin parity"`
- [ ] Verify goldens in `packages/core/core/test/__fixtures__/plugin-parity/<plugin>/`
- [ ] Confirm determinism (rerun, no golden drift) and document any intentional updates
