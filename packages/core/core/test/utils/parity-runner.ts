import path from 'path';
import Atlaspack from '../../src/Atlaspack';
import {writeSummary} from './artifacts';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../../');

export async function runParityBuild(
  fixturePath: string,
  options: {entry?: string} = {},
) {
  const engineEnv = process.env.ATLASPACK_ENGINE || 'js';
  const engines = engineEnv === 'dual' ? ['js', 'rust'] : [engineEnv];
  const fixtureName = path.basename(fixturePath);

  for (const engine of engines) {
    try {
      await runSingleBuild(engine, fixturePath, fixtureName, options);
    } catch (err) {
      if (engine === 'rust') {
        // eslint-disable-next-line no-console
        console.warn(
          `[Parity Runner] Rust build failed for ${fixtureName}:`,
          err,
        );
      } else {
        throw err;
      }
    }
  }
}

async function runSingleBuild(
  engine: string,
  fixturePath: string,
  fixtureName: string,
  options: {entry?: string},
) {
  const entry = options.entry || 'index.js';
  const entryPath = path.join(fixturePath, entry);
  const outputDir = path.join(
    PROJECT_ROOT,
    '.parcel-cache/parity',
    engine,
    fixtureName,
  );

  const atlaspack = new Atlaspack({
    entries: entryPath,
    mode: 'production',
    shouldDisableCache: true,
    defaultConfig: '@atlaspack/config-default',
    defaultTargetOptions: {
      distDir: outputDir,
      engines: {
        browsers: ['last 1 Chrome version'],
      },
    },
    env: {
      ATLASPACK_ENGINE: engine,
    },
  });

  const {bundleGraph, buildTime} = await atlaspack.run();

  const bundles = bundleGraph.getBundles().map((b: any) => ({
    filePath: path.relative(PROJECT_ROOT, b.filePath),
    type: b.type,
    id: b.id,
  }));

  const summaryPath = path.join(outputDir, 'summary.json');

  writeSummary(
    {
      engine,
      fixture: fixtureName,
      timings: {buildTime},
      bundles,
    },
    summaryPath,
  );
}
