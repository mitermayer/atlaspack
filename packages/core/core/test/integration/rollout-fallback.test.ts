import assert from 'assert';
import Atlaspack, {createWorkerFarm} from '../../src/Atlaspack';
import {FILE_CONFIG_NO_REPORTERS} from '@atlaspack/test-utils';
import path from 'path';

describe('Rollout & Fallback Integration', function () {
  const originalEnv = process.env;
  const fixtureEntry = path.join(__dirname, '../fixtures/atlaspack/index.js');
  let workerFarm;

  beforeEach(() => {
    process.env = {...originalEnv};
    delete process.env.ATLASPACK_ENGINE;
    workerFarm = createWorkerFarm();
  });

  afterEach(() => {
    process.env = originalEnv;
    workerFarm.end();
  });

  it('defaults to JS engine (rustEngineEnabled: false)', async () => {
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        workerFarm,
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
        workerFarm,
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
        workerFarm,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    assert.strictEqual(options.featureFlags.rustEngineEnabled, true);
    assert.strictEqual(options.featureFlags.rustEngineDualRun, true);
  });

  it('explicitly sets JS engine via ATLASPACK_ENGINE=js', async () => {
    process.env.ATLASPACK_ENGINE = 'js';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        workerFarm,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    assert.strictEqual(options.featureFlags.rustEngineEnabled, false);
    assert.strictEqual(options.featureFlags.rustEngineDualRun, false);
  });

  it('CLI/InitialOptions override ATLASPACK_ENGINE', async () => {
    process.env.ATLASPACK_ENGINE = 'rust';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        featureFlags: {
            rustEngineEnabled: false
        },
        workerFarm,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    assert.strictEqual(options.featureFlags.rustEngineEnabled, false);
  });

  it('CLI/InitialOptions override ATLASPACK_ENGINE for dual run', async () => {
    process.env.ATLASPACK_ENGINE = 'dual';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        featureFlags: {
            rustEngineDualRun: false
        },
        workerFarm,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    // rustEngineEnabled should be true from ATLASPACK_ENGINE=dual
    assert.strictEqual(options.featureFlags.rustEngineEnabled, true);
    // rustEngineDualRun should be false from CLI override
    assert.strictEqual(options.featureFlags.rustEngineDualRun, false);
  });

  it('handles invalid ATLASPACK_ENGINE values gracefully', async () => {
    process.env.ATLASPACK_ENGINE = 'invalid';
    
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        workerFarm,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    
    // Should maintain default values
    assert.strictEqual(options.featureFlags.rustEngineEnabled, false);
    assert.strictEqual(options.featureFlags.rustEngineDualRun, false);
  });

  it('handles case-insensitive ATLASPACK_ENGINE values', async () => {
    process.env.ATLASPACK_ENGINE = 'RUST';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        workerFarm,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    assert.strictEqual(options.featureFlags.rustEngineEnabled, true);
    assert.strictEqual(options.featureFlags.rustEngineDualRun, false);
  });

  it('force disables Rust engine via ATLASPACK_ENGINE_FORCE_JS_FALLBACK=true', async () => {
    process.env.ATLASPACK_ENGINE = 'rust';
    process.env.ATLASPACK_ENGINE_FORCE_JS_FALLBACK = 'true';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        workerFarm,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    
    // Should be disabled despite ATLASPACK_ENGINE=rust
    assert.strictEqual(options.featureFlags.rustEngineEnabled, false);
    assert.strictEqual(options.featureFlags.rustEngineDualRun, false);
    assert.strictEqual(options.featureFlags.atlaspackV3, false);
    
    delete process.env.ATLASPACK_ENGINE_FORCE_JS_FALLBACK;
  });

  it('force disables Rust engine via rustEngineForceJsFallback feature flag', async () => {
    process.env.ATLASPACK_ENGINE = 'rust';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        workerFarm,
        featureFlags: {
            rustEngineForceJsFallback: true
        }
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    
    // Should be disabled despite ATLASPACK_ENGINE=rust
    assert.strictEqual(options.featureFlags.rustEngineEnabled, false);
    assert.strictEqual(options.featureFlags.rustEngineDualRun, false);
    assert.strictEqual(options.featureFlags.atlaspackV3, false);
  });

  it('bridges rustEngineEnabled to atlaspackV3', async () => {
    process.env.ATLASPACK_ENGINE = 'rust';
    const atlaspack = new Atlaspack({
        entries: fixtureEntry,
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
        shouldDisableCache: true,
        workerFarm,
    });
    // @ts-ignore
    await atlaspack._init();
    // @ts-ignore
    const options = atlaspack._getResolvedAtlaspackOptions();
    
    assert.strictEqual(options.featureFlags.rustEngineEnabled, true);
    assert.strictEqual(options.featureFlags.atlaspackV3, true);
  });
});
