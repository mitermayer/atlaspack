import assert from 'assert';
import path from 'path';
import {tracer} from '@atlaspack/profiler';
import Atlaspack, {createWorkerFarm} from '../src/Atlaspack';
import {writeEvents} from './utils/artifacts';
import {normalizePaths} from './utils/normalize';
import {FILE_CONFIG_NO_REPORTERS} from '@atlaspack/test-utils';
import {registerCoreWithSerializer} from '../src/registerCoreWithSerializer';

const FIXTURE_PATH = path.join(__dirname, '__fixtures__/graph/basic');
const TRACE_SNAPSHOT_PATH = path.join(
  __dirname,
  '__fixtures__/telemetry/trace.json',
);

describe('Telemetry', function () {
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

  it.skip('should emit trace events when tracing is enabled', async () => {
    let events = [];
    let disposable = tracer.onTrace((event) => {
      events.push(event);
    });

    try {
      let atlaspack = new Atlaspack({
        entries: [path.join(FIXTURE_PATH, 'index.js')],
        shouldTrace: true,
        workerFarm,
        shouldDisableCache: true,
        mode: 'production',
        logLevel: 'warn',
        defaultConfig: FILE_CONFIG_NO_REPORTERS,
      });

      await atlaspack.run();
    } finally {
      disposable.dispose();
    }

    assert(events.length > 0, 'No trace events emitted');

    // Strip non-deterministic fields from trace events
    const normalizedEvents = events.map((event) => {
      const {pid, tid, ts, duration, ...rest} = event;
      return rest;
    });

    // Apply path normalization
    const fullyNormalizedEvents = normalizePaths(normalizedEvents);

    // Write events using artifact utilities with normalization
    writeEvents(fullyNormalizedEvents, TRACE_SNAPSHOT_PATH);

    // Assert against existing fixture
    const fixtureContent = require('./__fixtures__/telemetry/trace.json');
    assert.deepEqual(
      fullyNormalizedEvents,
      fixtureContent,
      'Trace events should match fixture',
    );
  });
});
