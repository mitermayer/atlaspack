import assert from 'assert';
import path from 'path';
import fs from 'fs';
import Atlaspack from '../../src/Atlaspack';
import tempy from 'tempy';

const FILE_CONFIG_NO_REPORTERS = path.join(__dirname, '../../../test-utils/configs/.parcelrc-no-reporters');

describe('Cache Invalidation Integration', function () {
  this.timeout(100000);
  let cacheDir;
  let outDir;
  let tmpDir;

  beforeEach(() => {
    tmpDir = tempy.directory();
    cacheDir = path.join(tmpDir, '.parcel-cache');
    outDir = path.join(tmpDir, 'dist');
    fs.mkdirSync(path.join(tmpDir, 'src'), {recursive: true});
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-app',
      version: '1.0.0',
      main: 'dist/index.js',
      targets: {
          types: false,
          main: {
              distDir: 'dist',
              engines: {
                  node: '>= 12'
              }
          }
      }
    }));
    fs.writeFileSync(path.join(tmpDir, 'src/index.js'), 'console.log("hello");');
  });

  afterEach(async () => {
    try {
        fs.rmSync(tmpDir, {recursive: true, force: true});
    } catch (e) {
        // ignore
    }
  });

  it('recovers from cache corruption', async () => {
    const entry = path.join(tmpDir, 'src/index.js');
    let atlaspack = new Atlaspack({
      entries: entry,
      defaultConfig: FILE_CONFIG_NO_REPORTERS,
      cacheDir,
      projectRoot: tmpDir,
      shouldDisableCache: false,
    });

    await atlaspack.run();
    assert(fs.existsSync(path.join(outDir, 'index.js')));

    // Corrupt the cache
    if (fs.existsSync(cacheDir)) {
        const cacheFiles = fs.readdirSync(cacheDir);
        // Find a large blob or data file
        const dataFile = cacheFiles.find(f => f.endsWith('.mdb') || f.includes('data'));
        if (dataFile) {
             const filePath = path.join(cacheDir, dataFile);
             // Corrupt it by writing random bytes at the beginning
             const fd = fs.openSync(filePath, 'r+');
             fs.writeSync(fd, Buffer.from('corrupted'), 0, 9, 0);
             fs.closeSync(fd);
        } else if (cacheFiles.length > 0) {
             // Just overwrite the first file
             fs.writeFileSync(path.join(cacheDir, cacheFiles[0]), 'garbage data');
        }
    }

    // Run again
    atlaspack = new Atlaspack({
      entries: entry,
      defaultConfig: FILE_CONFIG_NO_REPORTERS,
      cacheDir,
      projectRoot: tmpDir,
      shouldDisableCache: false,
    });

    await atlaspack.run();
    
    assert(fs.existsSync(path.join(outDir, 'index.js')));
  });

  it('invalidates on option change', async () => {
    const entry = path.join(tmpDir, 'src/index.js');
    let atlaspack = new Atlaspack({
      entries: entry,
      defaultConfig: FILE_CONFIG_NO_REPORTERS,
      cacheDir,
      projectRoot: tmpDir,
      mode: 'development',
      shouldDisableCache: false,
    });

    await atlaspack.run();
    const devStats = fs.statSync(path.join(outDir, 'index.js'));

    // Sleep a bit to ensure mtime change if FS resolution is low
    await new Promise(r => setTimeout(r, 1000));

    atlaspack = new Atlaspack({
      entries: entry,
      defaultConfig: FILE_CONFIG_NO_REPORTERS,
      cacheDir,
      projectRoot: tmpDir,
      mode: 'production',
      shouldDisableCache: false,
    });

    await atlaspack.run();
    const prodStats = fs.statSync(path.join(outDir, 'index.js'));

    assert.ok(prodStats.mtimeMs > devStats.mtimeMs, 'Output file should have been updated');
  });
});
