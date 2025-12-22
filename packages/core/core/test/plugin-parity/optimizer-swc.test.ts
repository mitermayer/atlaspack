import assert from 'assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Atlaspack from '../../src/Atlaspack';

const FIXTURE_SRC = path.join(
  __dirname,
  '../__fixtures__/plugin-parity/optimizer-swc',
);

describe('plugin parity: optimizer-swc', function () {
  this.timeout(50000);

  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'optimizer-swc-test-')),
    );
    fs.cpSync(FIXTURE_SRC, tmpDir, {recursive: true});
    process.chdir(tmpDir);

    // Rewrite .parcelrc to use absolute path for config-default
    const parcelrcPath = path.join(tmpDir, '.parcelrc');
    const parcelrc = JSON.parse(fs.readFileSync(parcelrcPath, 'utf8'));
    const configDefaultPath = path.resolve(
      __dirname,
      '../../../../configs/default',
    );
    parcelrc.extends = configDefaultPath;
    fs.writeFileSync(parcelrcPath, JSON.stringify(parcelrc, null, 2));

    // Symlink node_modules to allow plugin resolution
    fs.symlinkSync(
      path.resolve(__dirname, '../../../../../node_modules'),
      path.join(tmpDir, 'node_modules'),
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  it('matches golden output', async () => {
    const goldenPath = path.join(FIXTURE_SRC, 'golden.json'); // Keep golden in source

    const atlaspack = new Atlaspack({
      entries: 'index.js',
      mode: 'production',
      shouldDisableCache: true,
      defaultConfig: path.join(tmpDir, '.parcelrc'),
      targets: ['app'],
      env: {
        // Run with JS engine first to generate golden if needed
      },
    });

    const {bundleGraph} = await atlaspack.run();

    let jsBundle;
    bundleGraph.traverseBundles((bundle) => {
      if (bundle.type === 'js') {
        jsBundle = bundle;
      }
    });

    assert(jsBundle, 'Could not find JS bundle');

    // @ts-expect-error bundle.filePath is possibly undefined in types but valid here
    const outputCode = fs.readFileSync(jsBundle.filePath, 'utf8');

    const result = {
      code: outputCode,
    };

    // Snapshot logic
    if (process.env.UPDATE_GOLDENS || !fs.existsSync(goldenPath)) {
      fs.writeFileSync(goldenPath, JSON.stringify(result, null, 2));
    } else {
      const expected = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
      assert.strictEqual(
        result.code.trim(),
        expected.code.trim(),
        'Optimized code does not match golden',
      );
    }
  });

  it('matches golden output with Rust engine', async () => {
    const goldenPath = path.join(FIXTURE_SRC, 'golden.json');

    const atlaspack = new Atlaspack({
      entries: 'index.js',
      mode: 'production',
      shouldDisableCache: true,
      defaultConfig: path.join(tmpDir, '.parcelrc'),
      targets: ['app'],
      env: {
        ATLASPACK_ENGINE: 'rust',
      },
    });

    const {bundleGraph} = await atlaspack.run();

    let jsBundle;
    bundleGraph.traverseBundles((bundle) => {
      if (bundle.type === 'js') {
        jsBundle = bundle;
      }
    });

    assert(jsBundle, 'Could not find JS bundle');

    // @ts-expect-error bundle.filePath is possibly undefined in types but valid here
    const outputCode = fs.readFileSync(jsBundle.filePath, 'utf8');

    const expected = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
    assert.strictEqual(
      outputCode.trim(),
      expected.code.trim(),
      'Optimized code does not match golden (Rust engine)',
    );
  });
});
