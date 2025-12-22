import assert from 'assert';
import path from 'path';
import {bundle, outputFS, distDir} from '@atlaspack/test-utils';

const describe = (name, fn) => {
  // Simple describe wrapper to match Mocha's structure
  fn();
};

const it = (name, fn) => {
  // Simple it wrapper to match Mocha's structure
  // We will export these to be run by Mocha
  global.it(name, fn);
};

describe('Rust Babel Adapter', function () {
  global.it('runs a basic babel plugin via the Rust engine', async function () {
    // This uses the existing fixture 'babelrc-custom' which has a custom plugin
    // that replaces 'REPLACE_ME' with 'hello there'.
    const fixturePath = path.join(
      __dirname,
      'integration/babelrc-custom/index.js',
    );

    await bundle(fixturePath, {
      mode: 'production',
      defaultTargetOptions: {
        shouldOptimize: false,
      },
      logLevel: 'verbose',
    });

    let file = await outputFS.readFile(path.join(distDir, 'index.js'), 'utf8');

    // Check if the babel plugin ran
    assert(
      !file.includes('REPLACE_ME'),
      'Babel plugin did not run: REPLACE_ME still present',
    );
    assert(
      file.includes('hello there'),
      'Babel plugin did not run: output does not contain "hello there"',
    );
  });
});
