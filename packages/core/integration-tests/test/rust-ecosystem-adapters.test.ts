import assert from 'assert';
import path from 'path';
import {bundle, outputFS} from '@atlaspack/test-utils';

const babelFixture = path.join(__dirname, 'integration/babelrc-custom');
const postcssFixture = path.join(__dirname, 'integration/postcss-custom-rpc');

describe('Rust Ecosystem Adapters', function () {
  // Only run these tests when explicitly testing the Rust engine
  // This prevents noise in standard JS CI, but ensures we test what we want when targeted.
  if (process.env.ATLASPACK_ENGINE !== 'rust') {
    return;
  }

  it('should run JS-based Babel plugins via RPC', async function () {
    let b = await bundle(path.join(babelFixture, 'index.js'), {
      mode: 'development',
      defaultTargetOptions: {
        engines: {
          browsers: ['last 1 version'],
        },
      },
    });

    let output = await outputFS.readFile(b.getBundles()[0].filePath, 'utf8');
    assert(
      output.includes('hello there'),
      'Babel plugin did not run (expected "hello there")',
    );
    assert(
      !output.includes('REPLACE_ME'),
      'Babel plugin did not run (found "REPLACE_ME")',
    );
  });

  it('should run JS-based PostCSS plugins via RPC', async function () {
    let b = await bundle(path.join(postcssFixture, 'index.js'), {
      mode: 'development',
    });

    let output = await outputFS.readFile(
      b.getBundles().find((b) => b.type === 'css').filePath,
      'utf8',
    );
    // Basic minification might remove spaces, check both or loose match
    assert(
      output.includes('color:blue') ||
        output.includes('color: blue') ||
        output.includes('color:  blue'),
      'PostCSS plugin did not run (expected "color: blue")',
    );
    assert(!output.includes('red'), 'PostCSS plugin did not run (found "red")');
  });
});
