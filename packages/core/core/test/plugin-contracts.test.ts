import assert from 'assert';
import path from 'path';
import fs from 'fs';
import Atlaspack, {createWorkerFarm} from '../src/Atlaspack';
import {writeSummary, writeEvents} from './utils/artifacts';
import tempy from 'tempy';

const FIXTURE_PATH = path.join(__dirname, '__fixtures__/plugin-contracts');

describe('plugin contracts', function () {
  this.timeout(50000);

  let workerFarm;
  before(() => {
    workerFarm = createWorkerFarm();
  });

  after(async () => {
    await workerFarm.end();
  });

  describe('basic plugin functionality', () => {
    it('generates artifacts for successful builds', async () => {
      const artifactDir = tempy.directory();

      try {
        const events: any[] = [];
        const atlaspack = new Atlaspack({
          entries: [path.join(FIXTURE_PATH, 'index.js')],
          projectRoot: FIXTURE_PATH,
          workerFarm,
          mode: 'development',
          shouldDisableCache: true,
          defaultConfig: path.join(FIXTURE_PATH, '.parcelrc.reporter'),
          reporters: [
            {
              report({event}) {
                events.push(event);
              },
            },
          ],
        });

        const result = await atlaspack.run();

        writeSummary(result, path.join(artifactDir, 'basic-summary.json'));
        writeEvents(events, path.join(artifactDir, 'basic-events.json'));

        // Verify artifacts were created
        assert(
          fs.existsSync(path.join(artifactDir, 'basic-summary.json')),
          'Summary artifact should exist',
        );
        assert(
          fs.existsSync(path.join(artifactDir, 'basic-events.json')),
          'Events artifact should exist',
        );

        // Verify build succeeded
        assert(result, 'Build should return a result');
      } finally {
        fs.rmSync(artifactDir, {recursive: true, force: true});
      }
    });

    it('captures build events in different modes', async () => {
      const artifactDir = tempy.directory();

      try {
        const devEvents: any[] = [];
        const prodEvents: any[] = [];

        // Development build
        const devAtlaspack = new Atlaspack({
          entries: [path.join(FIXTURE_PATH, 'index.js')],
          projectRoot: FIXTURE_PATH,
          workerFarm,
          mode: 'development',
          shouldDisableCache: true,
          defaultConfig: path.join(FIXTURE_PATH, '.parcelrc.reporter'),
          reporters: [
            {
              report({event}) {
                devEvents.push(event);
              },
            },
          ],
        });

        const devResult = await devAtlaspack.run();
        writeSummary(devResult, path.join(artifactDir, 'dev-summary.json'));
        writeEvents(devEvents, path.join(artifactDir, 'dev-events.json'));

        // Production build
        const prodAtlaspack = new Atlaspack({
          entries: [path.join(FIXTURE_PATH, 'index.js')],
          projectRoot: FIXTURE_PATH,
          workerFarm,
          mode: 'production',
          shouldDisableCache: true,
          defaultConfig: path.join(FIXTURE_PATH, '.parcelrc.reporter'),
          reporters: [
            {
              report({event}) {
                prodEvents.push(event);
              },
            },
          ],
        });

        const prodResult = await prodAtlaspack.run();
        writeSummary(prodResult, path.join(artifactDir, 'prod-summary.json'));
        writeEvents(prodEvents, path.join(artifactDir, 'prod-events.json'));

        // Verify both builds succeeded
        assert(devResult, 'Dev build should return result');
        assert(prodResult, 'Prod build should return result');

        // Verify artifacts exist
        assert(
          fs.existsSync(path.join(artifactDir, 'dev-summary.json')),
          'Dev summary should exist',
        );
        assert(
          fs.existsSync(path.join(artifactDir, 'prod-summary.json')),
          'Prod summary should exist',
        );
        assert(
          fs.existsSync(path.join(artifactDir, 'dev-events.json')),
          'Dev events should exist',
        );
        assert(
          fs.existsSync(path.join(artifactDir, 'prod-events.json')),
          'Prod events should exist',
        );
      } finally {
        fs.rmSync(artifactDir, {recursive: true, force: true});
      }
    });

    it('handles multiple files correctly', async () => {
      const artifactDir = tempy.directory();

      try {
        const events: any[] = [];
        const atlaspack = new Atlaspack({
          entries: [path.join(FIXTURE_PATH, 'index.js')],
          projectRoot: FIXTURE_PATH,
          workerFarm,
          mode: 'development',
          shouldDisableCache: true,
          defaultConfig: path.join(FIXTURE_PATH, '.parcelrc.reporter'),
          reporters: [
            {
              report({event}) {
                events.push(event);
              },
            },
          ],
        });

        const result = await atlaspack.run();

        writeSummary(result, path.join(artifactDir, 'multi-file-summary.json'));
        writeEvents(events, path.join(artifactDir, 'multi-file-events.json'));

        // Verify artifacts were created
        assert(
          fs.existsSync(path.join(artifactDir, 'multi-file-summary.json')),
          'Summary artifact should exist',
        );
        assert(
          fs.existsSync(path.join(artifactDir, 'multi-file-events.json')),
          'Events artifact should exist',
        );

        // Verify build succeeded
        assert(result, 'Build should return a result');
      } finally {
        fs.rmSync(artifactDir, {recursive: true, force: true});
      }
    });

    it('generates consistent artifacts across builds', async () => {
      const artifactDir = tempy.directory();

      try {
        const events1: any[] = [];
        const events2: any[] = [];

        // First build
        const atlaspack1 = new Atlaspack({
          entries: [path.join(FIXTURE_PATH, 'index.js')],
          projectRoot: FIXTURE_PATH,
          workerFarm,
          mode: 'development',
          shouldDisableCache: true,
          defaultConfig: path.join(FIXTURE_PATH, '.parcelrc.reporter'),
          reporters: [
            {
              report({event}) {
                events1.push(event);
              },
            },
          ],
        });

        const result1 = await atlaspack1.run();
        writeSummary(
          result1,
          path.join(artifactDir, 'consistent-summary-1.json'),
        );
        writeEvents(
          events1,
          path.join(artifactDir, 'consistent-events-1.json'),
        );

        // Second build
        const atlaspack2 = new Atlaspack({
          entries: [path.join(FIXTURE_PATH, 'index.js')],
          projectRoot: FIXTURE_PATH,
          workerFarm,
          mode: 'development',
          shouldDisableCache: true,
          defaultConfig: path.join(FIXTURE_PATH, '.parcelrc.reporter'),
          reporters: [
            {
              report({event}) {
                events2.push(event);
              },
            },
          ],
        });

        const result2 = await atlaspack2.run();
        writeSummary(
          result2,
          path.join(artifactDir, 'consistent-summary-2.json'),
        );
        writeEvents(
          events2,
          path.join(artifactDir, 'consistent-events-2.json'),
        );

        // Read and compare artifacts
        const summary1 = JSON.parse(
          fs.readFileSync(
            path.join(artifactDir, 'consistent-summary-1.json'),
            'utf8',
          ),
        );
        const summary2 = JSON.parse(
          fs.readFileSync(
            path.join(artifactDir, 'consistent-summary-2.json'),
            'utf8',
          ),
        );
        const eventsData1 = JSON.parse(
          fs.readFileSync(
            path.join(artifactDir, 'consistent-events-1.json'),
            'utf8',
          ),
        );
        const eventsData2 = JSON.parse(
          fs.readFileSync(
            path.join(artifactDir, 'consistent-events-2.json'),
            'utf8',
          ),
        );

        // Summaries should be identical (deterministic)
        assert.deepStrictEqual(
          summary1,
          summary2,
          'Build summaries should be identical',
        );

        // Events should have same structure (timestamps stripped)
        assert.strictEqual(
          eventsData1.length,
          eventsData2.length,
          'Events count should match',
        );
      } finally {
        fs.rmSync(artifactDir, {recursive: true, force: true});
      }
    });
  });
});
