import assert from 'assert';
import Atlaspack from '../../src/Atlaspack';
import {FILE_CONFIG_NO_REPORTERS} from '@atlaspack/test-utils';
import path from 'path';

describe('Rollout & Fallback Integration', function () {
  const originalEnv = process.env;
  const fixtureEntry = path.join(__dirname, '../fixtures/atlaspack/index.js');

  beforeEach(() => {
    process.env = {...originalEnv};
    delete process.env.ATLASPACK_ENGINE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to JS engine (rustEngineEnabled: false)', async () => {
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    assert.strictEqual(options.featureFlags.rustEngineEnabled, false);
    assert.strictEqual(options.featureFlags.rustEngineDualRun, false);
  });

  it('enables Rust engine via ATLASPACK_ENGINE=rust', async () => {
    process.env.ATLASPACK_ENGINE = 'rust';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    assert.strictEqual(options.featureFlags.rustEngineEnabled, true);
    assert.strictEqual(options.featureFlags.rustEngineDualRun, false);
  });

  it('enables Dual Run via ATLASPACK_ENGINE=dual', async () => {
    process.env.ATLASPACK_ENGINE = 'dual';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    assert.strictEqual(options.featureFlags.rustEngineEnabled, true);
    assert.strictEqual(options.featureFlags.rustEngineDualRun, true);
  });

  it('CLI/InitialOptions override ATLASPACK_ENGINE', async () => {
    process.env.ATLASPACK_ENGINE = 'rust';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        featureFlags: {
            rustEngineEnabled: false
        }
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    assert.strictEqual(options.featureFlags.rustEngineEnabled, false);
  });
});
