import assert from 'assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {NodeFS} from '@atlaspack/fs';
import Atlaspack from '../../src/Atlaspack';
import {writeSummary, writeEvents} from '../utils/artifacts';

const FIXTURE_SRC = path.join(
  __dirname,
  '../__fixtures__/plugin-parity/optimizer-css',
);

describe('plugin parity: optimizer-css', function () {
  this.timeout(50000);

  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'optimizer-css-test-')),
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
    const outputDir = path.join(tmpDir, 'dist');
    const goldenPath = path.join(FIXTURE_SRC, 'golden.json'); // Keep golden in source

    const atlaspack = new Atlaspack({
      entries: 'index.css',
      mode: 'production',
      shouldDisableCache: true,
      defaultConfig: path.join(tmpDir, '.parcelrc'),
      defaultTargetOptions: {
        distDir: outputDir,
        engines: {
          browsers: ['last 1 Chrome version'],
        },
        shouldOptimize: true,
        shouldScopeHoist: false,
        outputFormat: 'esmodule',
      },
      env: {
        // Run with JS engine first to generate golden if needed, or just run with current engine
      },
    });

    const {bundleGraph} = await atlaspack.run();

    // Find the bundle for index.css
    // Unlike transformer tests where we check assets, for optimizer we check bundles.
    let cssBundle;
    bundleGraph.traverseBundles((bundle) => {
      if (bundle.type === 'css') {
        cssBundle = bundle;
      }
    });

    assert(cssBundle, 'Could not find CSS bundle');

    // Read the output file
    // @ts-expect-error bundle.filePath is possibly undefined in types but valid here
    const outputCode = fs.readFileSync(cssBundle.filePath, 'utf8');

    const result = {
      code: outputCode,
    };

    // Snapshot logic
    if (process.env.UPDATE_GOLDENS || !fs.existsSync(goldenPath)) {
      // If we are updating goldens, we assume we are running with JS engine or a trusted engine
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
    const outputDir = path.join(tmpDir, 'dist');
    const goldenPath = path.join(FIXTURE_SRC, 'golden.json');

    const atlaspack = new Atlaspack({
      entries: 'index.css',
      mode: 'production',
      shouldDisableCache: true,
      defaultConfig: path.join(tmpDir, '.parcelrc'),
      defaultTargetOptions: {
        distDir: outputDir,
        engines: {
          browsers: ['last 1 Chrome version'],
        },
        shouldOptimize: true,
        shouldScopeHoist: false,
        outputFormat: 'esmodule',
      },
      env: {
        ATLASPACK_ENGINE: 'rust',
      },
    });

    const {bundleGraph} = await atlaspack.run();

    let cssBundle;
    bundleGraph.traverseBundles((bundle) => {
      if (bundle.type === 'css') {
        cssBundle = bundle;
      }
    });

    assert(cssBundle, 'Could not find CSS bundle');

    // @ts-expect-error bundle.filePath is possibly undefined in types but valid here
    const outputCode = fs.readFileSync(cssBundle.filePath, 'utf8');

    const expected = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
    assert.strictEqual(
      outputCode.trim(),
      expected.code.trim(),
      'Optimized code does not match golden (Rust engine)',
    );
  });
});
