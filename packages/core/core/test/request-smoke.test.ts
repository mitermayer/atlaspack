import assert from 'assert';
import path from 'path';
import fs from 'fs';
import {NodeFS} from '@atlaspack/fs';
import WorkerFarm from '@atlaspack/workers';
import {LMDBLiteCache} from '@atlaspack/cache';
import RequestTracker from '../src/RequestTracker';
import createAtlaspackBuildRequest from '../src/requests/AtlaspackBuildRequest';
import {registerCoreWithSerializer} from '../src/registerCoreWithSerializer';
import {DEFAULT_OPTIONS} from './test-utils';

const FIXTURE_DIR = path.join(__dirname, '__fixtures__/request-smoke');
const CACHE_DIR = path.join(FIXTURE_DIR, '.parcel-cache');

describe('request smoke', function () {
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

  it('builds, modifies dep, rebuilds', async () => {
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
      shouldDisableCache: false,
      inputFS: new NodeFS(),
      outputFS: new NodeFS(),
      // Ensure we use the same mode as default
      mode: 'development',
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

    // Build 1
    const depPath = path.join(FIXTURE_DIR, 'dep.js');
    fs.writeFileSync(depPath, "export const value = 'A';");
    assert.strictEqual(
      fs.readFileSync(depPath, 'utf8'),
      "export const value = 'A';",
    );

    await tracker.runRequest(request, {force: true});
    const snapshot1 = getGraphSnapshot(tracker.graph);

    // Modify dep.js
    const originalContent = fs.readFileSync(depPath, 'utf8');
    const newContent = originalContent.replace("'A'", "'B'");
    fs.writeFileSync(depPath, newContent);
    assert.strictEqual(
      fs.readFileSync(depPath, 'utf8'),
      "export const value = 'B';",
    );

    // Invalidate
    await tracker.respondToFSEvents([{path: depPath, type: 'update'}]);

    // Build 2
    await tracker.runRequest(request);
    const snapshot2 = getGraphSnapshot(tracker.graph);

    // Revert change
    fs.writeFileSync(depPath, originalContent);

    // Verify invalidation
    // The graph should have changed (different content keys or structure)
    try {
      assert.notDeepStrictEqual(snapshot1, snapshot2);
    } catch (e) {
      fs.writeFileSync(
        path.join(FIXTURE_DIR, 'graph.json'),
        JSON.stringify(snapshot2, null, 2),
      );
      throw e;
    }

    fs.writeFileSync(
      path.join(FIXTURE_DIR, 'graph.json'),
      JSON.stringify(snapshot2, null, 2),
    );
  });
});

function getGraphSnapshot(graph: any) {
  const serialized = graph.serialize();
  let depHash = null;
  const nodes = graph.nodes || serialized.nodes;

  if (nodes) {
    for (const node of nodes) {
      if (node) {
        // Look for BundleGraphRequest (type 2) result
        if (
          node.requestType === 2 &&
          node.result &&
          node.result.bundleGraph &&
          node.result.bundleGraph._graph &&
          node.result.bundleGraph._graph.nodes
        ) {
          for (const bgNode of node.result.bundleGraph._graph.nodes) {
            if (
              bgNode.type === 'asset' &&
              bgNode.value &&
              bgNode.value.filePath &&
              bgNode.value.filePath.endsWith('dep.js')
            ) {
              depHash = bgNode.value.outputHash;
            }
          }
        }
      }
    }
  }

  return {
    serialized: serialized,
    invalidNodes: Array.from(graph.invalidNodeIds),
    hasDep: graph.hasContentKey('dep.js'),
    depHash,
  };
}
