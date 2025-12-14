import assert from 'assert';
import path from 'path';
import {runParityBuild} from '../utils/parity-runner';

describe('Diagnostic Parity', function () {
  this.timeout(20000);

  // Fixtures that are expected to fail
  const ERROR_FIXTURES = [
    'config-malformed',
    // 'plugin-not-found', // Add this once fixture exists
  ];

  for (const fixture of ERROR_FIXTURES) {
    it(`should produce matching diagnostics for ${fixture}`, async () => {
      const fixturePath = path.join(__dirname, '../__fixtures__', fixture);

      // Ensure fixture exists before running
      // We can assume it exists for now or check fs.existsSync

      const {comparison} = await runParityBuild(fixturePath, {
        mode: 'production',
        compareOutputs: true,
        engine: 'dual',
      });

      if (!comparison) {
        throw new Error(
          'Comparison failed to generate - engines may have behaved differently regarding success/failure',
        );
      }

      // Check if both failed
      // The parity runner returns results even on failure now.
      // We rely on compareBuilds having populated the diagnostics diff.

      if (!comparison.diagnostics.match) {
        // eslint-disable-next-line no-console
        console.error(
          'Diagnostic Mismatch Details:',
          comparison.diagnostics.diffs.join('\n\n'),
        );
      }

      assert.ok(
        comparison.diagnostics.match,
        `Diagnostics should match for ${fixture}`,
      );
    });
  }
});
