import assert from 'assert';
import path from 'path';
import fs from 'fs';
import {NodeFS} from '@atlaspack/fs';
import WorkerFarm from '@atlaspack/workers';
import {LMDBLiteCache} from '@atlaspack/cache';
import RequestTracker, {requestTypes} from '../src/RequestTracker';
import createAtlaspackBuildRequest from '../src/requests/AtlaspackBuildRequest';
import {registerCoreWithSerializer} from '../src/registerCoreWithSerializer';
import {DEFAULT_OPTIONS} from './test-utils';
import {normalizePaths, stripTimestamps} from './utils/normalize';

const FIXTURE_DIR = path.join(__dirname, '__fixtures__/graph/basic');
const CACHE_DIR = path.join(FIXTURE_DIR, '.parcel-cache');

describe('graph parity', function () {
  this.timeout(100000);
  let farm: WorkerFarm;
  let tracker: RequestTracker;

  before(async () => {
    registerCoreWithSerializer();
    farm = new WorkerFarm({
      workerPath: require.resolve('../src/worker'),
      warmWorkers: true,
    });

    await farm.createHandle('runTransform');
    await farm.createHandle('runValidate');
    await farm.createHandle('runPackage');
    await farm.createHandle('childInit');
  });

  after(async () => {
    await farm.end();
  });

  it('generates matching graph snapshots for basic fixture', async () => {
    // Clean cache
    if (fs.existsSync(CACHE_DIR)) {
      fs.rmSync(CACHE_DIR, {recursive: true, force: true});
    }

    const options = {
      ...DEFAULT_OPTIONS,
      projectRoot: FIXTURE_DIR,
      cacheDir: CACHE_DIR,
      entries: [path.join(FIXTURE_DIR, 'index.js')],
      cache: new LMDBLiteCache(CACHE_DIR),
      shouldDisableCache: true,
      inputFS: new NodeFS(),
      outputFS: new NodeFS(),
      mode: 'production',
      env: {
        ...process.env,
        ATLASPACK_ENGINE: 'js',
      },
    };

    await options.cache.ensure();

    tracker = await RequestTracker.init({
      farm,
      options,
    });

    const {ref: optionsRef} = await farm.createSharedReference(options, false);

    const request = createAtlaspackBuildRequest({
      optionsRef,
      requestedAssetIds: new Set(),
      signal: undefined,
    });

    await tracker.runRequest(request, {force: true});

    // Extract graphs
    let assetGraph;
    let bundleGraph;

    const nodes = tracker.graph.nodes;
    for (const node of nodes) {
      if (node && node.result) {
        if (node.requestType === requestTypes.asset_graph_request) {
          assetGraph = node.result.assetGraph;
        } else if (node.requestType === requestTypes.bundle_graph_request) {
          bundleGraph = node.result.bundleGraph;
        }
      }
    }

    assert(assetGraph, 'AssetGraph not found');
    assert(bundleGraph, 'BundleGraph not found');

    // Snapshot AssetGraph
    const assetGraphSnapshot = normalizePaths(
      stripTimestamps(assetGraph.serialize()),
    );
    // Use a custom snapshot name or just rely on default
    // Using console.log to debug if needed, but here we want to fail if snapshot doesn't match
    // Since we don't have existing snapshots, running this will create them (if using snap-shot-it or similar)
    // But mocha doesn't have built-in snapshotting.
    // The requirement says "Snapshot the normalized JSON".
    // I should check how snapshots are handled in this repo.
    // Usually via `@atlaspack/test-utils` or just writing to a file and comparing?

    // In `request-smoke.test.ts`, they compare against previous run or write to file.
    // "Golden snapshots for core fixtures; enforce parity in CI (via dual-run harness outputs)."

    // I will write the snapshots to a file `graph.json` in the fixture directory,
    // similar to `request-smoke.test.ts` or `graph-parity.test.ts` expected output.

    // Actually, I'll just use a simple assertion for now, or write the snapshot to a file and compare.
    // Given the task description "Snapshot the normalized JSON", implies creating a file.

    const snapshotPath = path.join(FIXTURE_DIR, 'graph-snapshot.json');
    const snapshotData = JSON.parse(
      JSON.stringify({
        assetGraph: assetGraphSnapshot,
        bundleGraph: normalizePaths(stripTimestamps(bundleGraph.serialize())),
      }),
    );

    // For now, I'll write it if it doesn't exist, or compare if it does.
    // Or just write it out so the user can verify.
    // Since this is the first time, I'll write it.

    // However, for the test to pass "yarn test:js:unit --grep 'graph parity'", it needs to be deterministic.

    // I'll check if file exists.
    if (process.env.UPDATE_SNAPSHOTS || !fs.existsSync(snapshotPath)) {
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2));
    } else {
      const expected = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      assert.deepStrictEqual(snapshotData, expected);
    }
  });
});
