import assert from 'assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {bundle, run} from '@atlaspack/test-utils';

describe('JS Optimizer (Rust Engine)', function () {
  it('should run htmlnano via JS Host', async function () {
    process.env.ATLASPACK_ENGINE = 'rust';

    const tmpDir = fs.mkdtempSync(path.join('/tmp', 'atlaspack-test-'));
    const tmpFile = path.join(tmpDir, 'index.html');

    try {
      fs.writeFileSync(tmpFile, '<!-- comment --><div>  Whitespace  </div>');

      let b = await bundle(tmpFile, {
        defaultConfig: '@atlaspack/config-default',
        mode: 'production',
      });

      let html = await b.getBundles()[0].entryAsset.getCode();
      assert(
        !html.includes('<!-- comment -->'),
        'Should have removed comments',
      );
      assert(
        !html.includes('  Whitespace  '),
        'Should have collapsed whitespace',
      );
    } finally {
      fs.rmSync(tmpDir, {recursive: true, force: true});
    }
  });
});
