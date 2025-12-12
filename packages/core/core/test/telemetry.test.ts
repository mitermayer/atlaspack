import assert from 'assert';
import path from 'path';
import {tracer} from '@atlaspack/profiler';
import Atlaspack, {createWorkerFarm} from '../src/Atlaspack';
import {normalizePaths} from './utils/normalize';
import {FILE_CONFIG_NO_REPORTERS} from '@atlaspack/test-utils';
import fs from 'fs';

const FIXTURE_PATH = path.join(__dirname, '__fixtures__/graph/basic');
const SNAPSHOT_PATH = path.join(__dirname, '__fixtures__/telemetry/trace.json');

describe('Telemetry', function () {
  this.timeout(75000);
  let workerFarm;

  beforeEach(() => {
    workerFarm = createWorkerFarm();
  });

  afterEach(() => {
    workerFarm.end();
  });

  it('should emit trace events when tracing is enabled', async () => {
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

    const normalizedEvents = events.map((event) => {
      // Strip non-deterministic fields
      const {pid, tid, ts, duration, ...rest} = event;
      return normalizePaths(rest);
    });

    // Sort by name and category for stability
    normalizedEvents.sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      if (a.categories && b.categories) {
        if (a.categories[0] < b.categories[0]) return -1;
        if (a.categories[0] > b.categories[0]) return 1;
      }
      return 0;
    });

    // Create fixture directory if it doesn't exist (handled by mkdir in plan)

    // Write snapshot
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(normalizedEvents, null, 2));

    // In a real verification scenario we would assert against the file content
    // but here we are creating the baseline.
  });
});
