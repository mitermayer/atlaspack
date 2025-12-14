import assert from 'assert';
import path from 'path';
import Atlaspack, {createWorkerFarm} from '../src/Atlaspack';
import {writeSummary} from './utils/artifacts';
import {FILE_CONFIG_NO_REPORTERS} from '@atlaspack/test-utils';
import {registerCoreWithSerializer} from '../src/registerCoreWithSerializer';

const FIXTURE_PATH = path.join(__dirname, '__fixtures__/graph/basic');
const OBSERVABILITY_SNAPSHOT_PATH = path.join(
  __dirname,
  '__fixtures__/observability/summary.json',
);

describe('Observability Integration', function () {
  this.timeout(75000);
  let workerFarm;

  before(() => {
    registerCoreWithSerializer();
  });

  beforeEach(() => {
    workerFarm = createWorkerFarm();
  });

  afterEach(() => {
    workerFarm.end();
  });

  it('should generate observability data', async () => {
    let atlaspack = new Atlaspack({
      entries: [path.join(FIXTURE_PATH, 'index.js')],
      workerFarm,
      shouldDisableCache: true,
      mode: 'production',
      logLevel: 'warn',
      defaultConfig: FILE_CONFIG_NO_REPORTERS,
    });

    let result = await atlaspack.run();

    assert.equal(result.type, 'buildSuccess');
    if (result.type === 'buildSuccess') {
      const summary = {
        hasBuildTime: typeof result.buildTime === 'number',
        hasRequestStats: !!result.unstable_requestStats,
        buildTime: result.buildTime,
        requestStatsKeys: result.unstable_requestStats
          ? Object.keys(result.unstable_requestStats).sort()
          : [],
      };

      // Write summary using artifact utilities
      writeSummary(summary, OBSERVABILITY_SNAPSHOT_PATH);

      // Basic assertions
      assert(summary.hasBuildTime, 'Should have build time');
      assert(summary.hasRequestStats, 'Should have request stats');
      assert(
        Array.isArray(summary.requestStatsKeys),
        'Request stats keys should be array',
      );
      assert(
        summary.requestStatsKeys.length > 0,
        'Should have request stat keys',
      );
    }
  });
});
