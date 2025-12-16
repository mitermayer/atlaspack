import assert from 'assert';
import path from 'path';
import fs from 'fs';
import {ncp} from 'ncp';
import {promisify} from 'util';
import tempy from 'tempy';
import Atlaspack from '@atlaspack/core';

const ncpAsync = promisify(ncp);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const FIXTURE_ROOT = path.resolve(__dirname, '../__fixtures__/dual-smoke');

describe('incremental invalidation parity', function () {
  this.timeout(60000);

  async function runEditScript(engine: 'js' | 'rust', workDir: string) {
    const snapshots: any[] = [];
    let subscription: any;
    const entryFile = path.join(workDir, 'index.js');

    const atlaspack = new Atlaspack({
      entries: entryFile,
      defaultConfig: '@atlaspack/config-default',
      mode: 'development',
      env: {
        ATLASPACK_ENGINE: engine,
      },
      additionalReporters: [],
      shouldDisableCache: true, // Force fresh start, but incremental watch handles sub-builds
    });

    try {
      subscription = await atlaspack.watch((err, buildEvent) => {
        if (err) {
          throw err;
        }
        if (buildEvent && buildEvent.type === 'buildSuccess') {
          const changedAssets = Array.from(
            buildEvent.changedAssets.keys(),
          ).sort();

          // Normalize asset paths relative to workDir
          const relativeChangedAssets = changedAssets.map((p) => {
            // Some paths might be absolute
            if (p.startsWith(workDir)) {
              return p.replace(workDir, '<TMP>');
            }
            return p;
          });

          snapshots.push({
            type: 'buildSuccess',
            changedAssets: relativeChangedAssets,
            buildTime: buildEvent.buildTime > 0 ? 'positive' : 'zero',
          });
        }
      });

      // Wait for initial build
      await sleep(3000);

      // --- EDIT 1: Modify index.js ---
      const indexContent = fs.readFileSync(entryFile, 'utf8');
      fs.writeFileSync(entryFile, indexContent + '\nconsole.log("Edit 1");');
      await sleep(3000);

      // --- EDIT 2: Add new file and import it ---
      const newFile = path.join(workDir, 'new.js');
      fs.writeFileSync(newFile, 'export default "new";');
      fs.writeFileSync(
        entryFile,
        indexContent + '\nimport n from "./new.js"; console.log(n);',
      );
      await sleep(3000);

      // --- EDIT 3: Delete the new file (and revert import) ---
      fs.writeFileSync(entryFile, indexContent); // Revert import first to avoid error
      await sleep(1000);
      fs.unlinkSync(newFile);
      await sleep(3000);
    } finally {
      if (subscription) {
        await subscription.unsubscribe();
      }
      if ((atlaspack as any)?.unstable__end) {
        await (atlaspack as any).unstable__end();
      }
    }

    return snapshots;
  }

  it('produces identical invalidation sets for JS and Rust engines', async () => {
    // JS Run
    const jsDir = tempy.directory();
    await ncpAsync(FIXTURE_ROOT, jsDir);
    const jsSnapshots = await runEditScript('js', jsDir);

    // Rust Run
    const rustDir = tempy.directory();
    await ncpAsync(FIXTURE_ROOT, rustDir);
    const rustSnapshots = await runEditScript('rust', rustDir);

    // Comparison
    // We expect snapshots to match in length and content
    assert.strictEqual(
      jsSnapshots.length,
      rustSnapshots.length,
      'Snapshot count mismatch',
    );

    for (let i = 0; i < jsSnapshots.length; i++) {
      const js = jsSnapshots[i];
      const rust = rustSnapshots[i];

      assert.deepStrictEqual(
        js.changedAssets,
        rust.changedAssets,
        `Snapshot ${i} changedAssets mismatch`,
      );
    }
  });
});
