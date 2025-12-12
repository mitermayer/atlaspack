import assert from 'assert';
import path from 'path';
import fs from 'fs';
import {runParityBuild} from '../utils/parity-runner';
import {loadParityReport} from '../utils/parity-reporter';

describe('dual-run', function () {
  this.timeout(60000);

  it('should run dual-mode build and compare results', async () => {
    const fixturePath = path.join(__dirname, '../__fixtures__/dual-run-basic');

    // Run in dual mode (both JS and Rust engines)
    const result = await runParityBuild(fixturePath, {
      entry: 'index.js',
      compareOutputs: true,
    });

    // Should have JS result (always expected to work)
    assert(result.jsResult, 'JS result should exist');
    assert.strictEqual(result.jsResult.engine, 'js');
    assert.strictEqual(result.jsResult.fixtureName, 'dual-run-basic');
    assert(result.jsResult.bundles.length > 0, 'JS should produce bundles');

    // Check that summary was written
    const jsSummaryPath = path.join(result.jsResult.outputDir, 'summary.json');
    assert(fs.existsSync(jsSummaryPath), 'JS summary.json should exist');

    // If Rust engine is available and succeeded, check comparison
    if (result.rustResult) {
      assert.strictEqual(result.rustResult.engine, 'rust');
      assert.strictEqual(result.rustResult.fixtureName, 'dual-run-basic');

      // Check that Rust summary was written
      const rustSummaryPath = path.join(
        result.rustResult.outputDir,
        'summary.json',
      );
      assert(fs.existsSync(rustSummaryPath), 'Rust summary.json should exist');

      // Check comparison results
      assert(
        result.comparison,
        'Comparison should exist when both engines run',
      );
      assert(typeof result.comparison.bundleCount.match === 'boolean');
      assert(typeof result.comparison.bundleTypes.match === 'boolean');
      assert(Array.isArray(result.comparison.fileDifferences));
      assert(Array.isArray(result.comparison.contentDifferences));

      // Check that parity report was generated
      const report = loadParityReport('dual-run-basic');
      assert(report, 'Parity report should be generated');
      assert.strictEqual(report.fixtureName, 'dual-run-basic');
      assert(report.jsResult.bundleCount > 0);
      assert(report.rustResult.bundleCount > 0);
      assert(typeof report.summary.passed === 'boolean');
      assert(Array.isArray(report.summary.issues));
    }
  });

  it('should run JS-only build when not in dual mode', async () => {
    // Temporarily set engine to JS
    const originalEngine = process.env.ATLASPACK_ENGINE;
    process.env.ATLASPACK_ENGINE = 'js';

    try {
      const fixturePath = path.join(
        __dirname,
        '../__fixtures__/dual-run-basic',
      );

      const result = await runParityBuild(fixturePath, {
        entry: 'index.js',
        compareOutputs: true,
      });

      assert(result.jsResult, 'JS result should exist');
      assert(
        !result.rustResult,
        'Rust result should not exist in JS-only mode',
      );
      assert(!result.comparison, 'Comparison should not exist in JS-only mode');

      // Verify JS build worked
      const jsSummaryPath = path.join(
        result.jsResult.outputDir,
        'summary.json',
      );
      assert(fs.existsSync(jsSummaryPath), 'JS summary.json should exist');
    } finally {
      // Restore original engine setting
      if (originalEngine) {
        process.env.ATLASPACK_ENGINE = originalEngine;
      } else {
        delete process.env.ATLASPACK_ENGINE;
      }
    }
  });
});
