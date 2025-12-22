import assert from 'assert';
import path from 'path';
import Atlaspack, {createWorkerFarm} from '../src/Atlaspack';
import {FILE_CONFIG_NO_REPORTERS} from '@atlaspack/test-utils';
import {writeSummary} from './utils/artifacts';
import {registerCoreWithSerializer} from '../src/registerCoreWithSerializer';

const FIXTURE_PATH = path.join(__dirname, '__fixtures__/graph/basic');
const COUNTERS_SNAPSHOT_PATH = path.join(
  __dirname,
  '__fixtures__/perf/counters.json',
);

describe('Performance Counters', function () {
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

  it('should return performance metrics in build result', async () => {
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
      assert(typeof result.buildTime === 'number');
      assert(result.unstable_requestStats);

      const summary = {
        hasBuildTime: true,
        requestStatsKeys: Object.keys(result.unstable_requestStats).sort(),
      };

      // Write summary using artifact utilities with normalization
      writeSummary(summary, COUNTERS_SNAPSHOT_PATH);

      // Assert against existing fixture
      const fixtureContent = require('./__fixtures__/perf/counters.json');
      assert.deepEqual(
        summary,
        fixtureContent,
        'Performance counters should match fixture',
      );
    }
  });
});
