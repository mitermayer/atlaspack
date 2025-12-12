# Watch & HMR Parity — Start Here

Reuse Epic 0 utils; aim for deterministic traces.

## Key paths

- Tests: `packages/examples/kitchen-sink/__tests__/watch-hmr.test.ts`.
- Fixtures/traces: `packages/examples/kitchen-sink/__fixtures__/hmr/events.json`.
- Utils: `packages/core/core/test/utils/normalize.ts`.

## Commands

- Watch/HMR scripted flows: `yarn workspace @atlaspack/examples test --grep "watch hmr"`

## Definition of done

- Recorded/replayed HMR traces pass on JS (add/edit/delete/error-recover).
- No unintended full reloads; events normalized (paths, timestamps, ports).
- Commands documented for integration CI.

## Before merge (checklist)
- [ ] Run Epic 0 baseline commands
- [ ] Run watch/HMR tests: `yarn workspace @atlaspack/examples test --grep "watch hmr"`
- [ ] Verify HMR trace fixtures `packages/examples/kitchen-sink/__fixtures__/hmr/events.json`
- [ ] Confirm determinism (rerun scripted edits, traces stable)
