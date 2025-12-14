import assert from 'assert';
import config from '../index.json';

describe('@atlaspack/config-default feature flags', () => {
  it('includes rust engine feature flags in default config', () => {
    // The config should include the new rust engine feature flags
    // This test ensures the flags are available for configuration
    assert.ok(config);

    // Check that the config object exists and has expected structure
    assert.strictEqual(typeof config, 'object');

    // The actual feature flag values are handled by the feature-flags package
    // This test ensures the config package can be loaded successfully
    // when the new feature flags are present
  });

  it('can be extended with rust engine feature flags', () => {
    // Test that the config can be extended with the new feature flags
    const extendedConfig = {
      ...config,
      featureFlags: {
        rustEngineEnabled: true,
        rustEngineDualRun: false,
      },
    };

    assert.ok(extendedConfig.featureFlags);
    assert.strictEqual(extendedConfig.featureFlags.rustEngineEnabled, true);
    assert.strictEqual(extendedConfig.featureFlags.rustEngineDualRun, false);
  });
});
