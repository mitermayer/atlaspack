import assert from 'assert';
import path from 'path';
import fs from 'fs';
import {runParityBuild} from '../../../core/core/test/utils/parity-runner';

describe('dual-smoke', function () {
  this.timeout(100000);

  it('runs dual-smoke fixture', async () => {
    const fixturePath = path.join(__dirname, '../__fixtures__/dual-smoke');
    await runParityBuild(fixturePath, {entry: 'index.js'});

    const projectRoot = path.resolve(__dirname, '../../../../');
    // Default to 'js' check unless we know we ran something else, but strictly speaking
    // runParityBuild creates this path.
    const summaryPath = path.join(
      projectRoot,
      '.parcel-cache/parity/js/dual-smoke/summary.json',
    );

    // Only check if we are in JS or Dual mode (default is usually JS)
    const engine = process.env.ATLASPACK_ENGINE || 'js';
    if (engine === 'js' || engine === 'dual') {
      assert(fs.existsSync(summaryPath), 'summary.json should exist');

      const summaryContent = fs.readFileSync(summaryPath, 'utf8');
      const summary = JSON.parse(summaryContent);

      assert.strictEqual(summary.engine, 'js');
      assert.strictEqual(summary.fixture, 'dual-smoke');
      assert(Array.isArray(summary.bundles), 'bundles should be an array');
      assert(summary.bundles.length > 0, 'should have at least one bundle');
    }
  });
});
