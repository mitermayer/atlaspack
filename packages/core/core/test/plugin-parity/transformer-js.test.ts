import assert from 'assert';
import path from 'path';
import fs from 'fs';
import Atlaspack from '../../src/Atlaspack';

const FIXTURE_DIR = path.join(
  __dirname,
  '../__fixtures__/plugin-parity/transformer-js',
);
const GOLDEN_PATH = path.join(FIXTURE_DIR, 'golden.json');
const PROJECT_ROOT = path.resolve(__dirname, '../../../../../');

describe('plugin parity: transformer-js', function () {
  this.timeout(50000);

  it('matches golden output', async () => {
    const outputDir = path.join(FIXTURE_DIR, 'dist');
    const cacheDir = path.join(FIXTURE_DIR, '.parcel-cache');

    // Clean up
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, {recursive: true, force: true});
    }
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, {recursive: true, force: true});
    }

    const atlaspack = new Atlaspack({
      entries: path.join(FIXTURE_DIR, 'index.js'),
      mode: 'production',
      shouldDisableCache: true,
      defaultConfig: path.join(FIXTURE_DIR, '.parcelrc'),
      defaultTargetOptions: {
        distDir: outputDir,
        engines: {
          browsers: ['last 1 Chrome version'],
        },
        shouldOptimize: false, // We want to see the transformed code, not minified
        shouldScopeHoist: false, // We want to see the module code
        outputFormat: 'esmodule',
      },
      env: {
        ATLASPACK_ENGINE: 'js',
      },
    });

    const {bundleGraph} = await atlaspack.run();

    // Find the asset for index.js
    let indexAsset;
    bundleGraph.traverse((node) => {
      if (
        node.type === 'asset' &&
        path.basename(node.value.filePath) === 'index.js'
      ) {
        indexAsset = node.value;
      }
    });

    assert(indexAsset, 'Could not find index.js asset');

    // Get the code
    const code = await indexAsset.getCode();

    // Get dependencies
    const dependencies = indexAsset
      .getDependencies()
      .map((dep) => ({
        specifier: dep.specifier,
        priority: dep.priority,
        isOptional: dep.isOptional,
      }))
      .sort((a, b) => a.specifier.localeCompare(b.specifier));

    const result = {
      code,
      dependencies,
    };

    // Snapshot logic
    if (process.env.UPDATE_GOLDENS || !fs.existsSync(GOLDEN_PATH)) {
      fs.writeFileSync(GOLDEN_PATH, JSON.stringify(result, null, 2));
      // If we just created it, we pass
    } else {
      const expected = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
      assert.strictEqual(
        result.code.trim(),
        expected.code.trim(),
        'Transformed code does not match golden',
      );
      assert.deepStrictEqual(
        result.dependencies,
        expected.dependencies,
        'Dependencies do not match golden',
      );
    }
  });
});
