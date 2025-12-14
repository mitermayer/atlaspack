import assert from 'assert';
import path from 'path';
import fs from 'fs';
import Atlaspack, {createWorkerFarm} from '../src/Atlaspack';
import {writeSummary, writeEvents} from './utils/artifacts';
import tempy from 'tempy';

const FIXTURE_PATH = path.join(__dirname, '__fixtures__/plugin-pipeline');

describe('plugin pipeline', function () {
  this.timeout(50000);

  let workerFarm;
  before(() => {
    workerFarm = createWorkerFarm();
  });

  after(async () => {
    await workerFarm.end();
  });

  it('verifies execution order: Resolve -> Transform -> Bundle -> Package -> Optimize', async () => {
    const logFile = path.join(FIXTURE_PATH, 'execution-log.txt');
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }

    const artifactDir = tempy.directory();
    const events: any[] = [];

    let atlaspack = new Atlaspack({
      entries: [path.join(FIXTURE_PATH, 'index.js')],
      projectRoot: FIXTURE_PATH,
      workerFarm,
      mode: 'production',
      shouldDisableCache: true,
      shouldPatchConsole: true,
      logLevel: 'info',
      reporters: [
        {
          report({event}) {
            events.push(event);
          },
        },
      ],
    });

    const result = await atlaspack.run();

    // Write artifacts for analysis
    writeSummary(result, path.join(artifactDir, 'summary.json'));
    writeEvents(events, path.join(artifactDir, 'events.json'));

    const logs = fs.readFileSync(logFile, 'utf8').trim().split('\n');

    const resolvingIndex = logs.findIndex((l) =>
      l.includes('[resolver-log] Resolving'),
    );
    const transformingIndex = logs.findIndex((l) =>
      l.includes('[transformer-log] Transforming'),
    );
    const bundlingIndex = logs.findIndex((l) => l.includes('Phase: bundling'));
    const packagingIndex = logs.findIndex((l) =>
      l.includes('Phase: packaging'),
    );
    const optimizingIndex = logs.findIndex((l) =>
      l.includes('Phase: optimizing'),
    );
    const successIndex = logs.findIndex((l) =>
      l.includes('Phase: buildSuccess'),
    );

    assert(resolvingIndex !== -1, 'Missing resolving phase');
    assert(transformingIndex !== -1, 'Missing transforming phase');
    assert(bundlingIndex !== -1, 'Missing bundling phase');
    assert(packagingIndex !== -1, 'Missing packaging phase');
    assert(optimizingIndex !== -1, 'Missing optimizing phase');
    assert(successIndex !== -1, 'Missing buildSuccess phase');

    assert(
      resolvingIndex < bundlingIndex,
      'Resolving should happen before bundling',
    );
    assert(
      transformingIndex < bundlingIndex,
      'Transforming should happen before bundling',
    );

    assert(
      bundlingIndex < packagingIndex,
      'Bundling should happen before packaging',
    );
    assert(
      packagingIndex < optimizingIndex,
      'Packaging should happen before optimizing',
    );
    assert(
      optimizingIndex < successIndex,
      'Optimizing should happen before success',
    );

    // Verify artifacts were created
    assert(
      fs.existsSync(path.join(artifactDir, 'summary.json')),
      'Summary artifact should exist',
    );
    assert(
      fs.existsSync(path.join(artifactDir, 'events.json')),
      'Events artifact should exist',
    );

    // Clean up
    fs.rmSync(artifactDir, {recursive: true, force: true});
  });
});
