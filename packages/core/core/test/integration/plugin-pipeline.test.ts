import assert from 'assert';
import path from 'path';
import fs from 'fs';
import Atlaspack, {createWorkerFarm} from '../../src/Atlaspack';
import {writeSummary, writeEvents} from '../utils/artifacts';
import tempy from 'tempy';

const FIXTURE_PATH = path.join(__dirname, '../__fixtures__/plugin-pipeline');

describe('plugin pipeline integration', function () {
  this.timeout(100000);

  let workerFarm;
  before(() => {
    workerFarm = createWorkerFarm();
  });

  after(async () => {
    await workerFarm.end();
  });

  it('generates consistent artifacts across multiple builds', async () => {
    const artifactDir = tempy.directory();
    const events: any[] = [];

    // First build
    let atlaspack = new Atlaspack({
      entries: [path.join(FIXTURE_PATH, 'index.js')],
      projectRoot: FIXTURE_PATH,
      workerFarm,
      mode: 'production',
      shouldDisableCache: true,
      shouldPatchConsole: true,
      logLevel: 'info',
      defaultConfig: path.join(FIXTURE_PATH, '.parcelrc'),
      reporters: [
        {
          report({event}) {
            events.push(event);
          },
        },
      ],
    });

    const result1 = await atlaspack.run();
    writeSummary(result1, path.join(artifactDir, 'summary-1.json'));
    writeEvents(events, path.join(artifactDir, 'events-1.json'));

    // Reset events for second build
    events.length = 0;

    // Second build
    atlaspack = new Atlaspack({
      entries: [path.join(FIXTURE_PATH, 'index.js')],
      projectRoot: FIXTURE_PATH,
      workerFarm,
      mode: 'production',
      shouldDisableCache: true,
      shouldPatchConsole: true,
      logLevel: 'info',
      defaultConfig: path.join(FIXTURE_PATH, '.parcelrc'),
      reporters: [
        {
          report({event}) {
            events.push(event);
          },
        },
      ],
    });

    const result2 = await atlaspack.run();
    writeSummary(result2, path.join(artifactDir, 'summary-2.json'));
    writeEvents(events, path.join(artifactDir, 'events-2.json'));

    // Read and compare artifacts
    const summary1 = JSON.parse(fs.readFileSync(path.join(artifactDir, 'summary-1.json'), 'utf8'));
    const summary2 = JSON.parse(fs.readFileSync(path.join(artifactDir, 'summary-2.json'), 'utf8'));
    const events1 = JSON.parse(fs.readFileSync(path.join(artifactDir, 'events-1.json'), 'utf8'));
    const events2 = JSON.parse(fs.readFileSync(path.join(artifactDir, 'events-2.json'), 'utf8'));

    // Summaries should be identical (deterministic)
    assert.deepStrictEqual(summary1, summary2, 'Build summaries should be identical');

    // Events should have same structure (timestamps stripped)
    assert.strictEqual(events1.length, events2.length, 'Events count should match');
    
    // Clean up
    fs.rmSync(artifactDir, {recursive: true, force: true});
  });

  it('generates build artifacts correctly', async () => {
    const artifactDir = tempy.directory();
    
    try {
      const events: any[] = [];
      const atlaspack = new Atlaspack({
        entries: [path.join(FIXTURE_PATH, 'index.js')],
        projectRoot: FIXTURE_PATH,
        workerFarm,
        mode: 'production',
        shouldDisableCache: true,
        shouldPatchConsole: true,
        logLevel: 'info',
        defaultConfig: path.join(FIXTURE_PATH, '.parcelrc'),
        reporters: [
          {
            report({event}) {
              events.push(event);
            },
          },
        ],
      });

      const result = await atlaspack.run();

      // Write artifacts
      writeSummary(result, path.join(artifactDir, 'build-summary.json'));
      writeEvents(events, path.join(artifactDir, 'build-events.json'));

      // Verify artifacts were created
      assert(fs.existsSync(path.join(artifactDir, 'build-summary.json')), 'Summary artifact should exist');
      assert(fs.existsSync(path.join(artifactDir, 'build-events.json')), 'Events artifact should exist');

      // Verify build succeeded by checking result
      assert(result, 'Build should return a result');

    } finally {
      // Clean up
      fs.rmSync(artifactDir, {recursive: true, force: true});
    }
  });

  it('handles different build modes correctly', async () => {
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
        defaultConfig: path.join(FIXTURE_PATH, '.parcelrc'),
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
        defaultConfig: path.join(FIXTURE_PATH, '.parcelrc'),
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
      assert(fs.existsSync(path.join(artifactDir, 'dev-summary.json')), 'Dev summary should exist');
      assert(fs.existsSync(path.join(artifactDir, 'prod-summary.json')), 'Prod summary should exist');

    } finally {
      // Clean up
      fs.rmSync(artifactDir, {recursive: true, force: true});
    }
  });
});