import path from 'path';
import Atlaspack from '../../src/Atlaspack';
import {writeSummary} from './artifacts';
import {compareBuilds} from './diff';
import {generateParityReport} from './parity-reporter';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../../');

export interface ParityOptions {
  entry?: string;
  mode?: 'development' | 'production';
  compareOutputs?: boolean;
}

export interface BuildResult {
  engine: string;
  fixtureName: string;
  bundleGraph: any;
  buildTime: number;
  bundles: Array<{
    filePath: string;
    type: string;
    id: string;
  }>;
  outputDir: string;
}

export async function runParityBuild(
  fixturePath: string,
  options: ParityOptions = {},
): Promise<{
  jsResult?: BuildResult;
  rustResult?: BuildResult;
  comparison?: any;
}> {
  const engineEnv = process.env.ATLASPACK_ENGINE || 'js';
  const engines = engineEnv === 'dual' ? ['js', 'rust'] : [engineEnv];
  const fixtureName = path.basename(fixturePath);

  const results: Record<string, BuildResult> = {};

  for (const engine of engines) {
    try {
      const result = await runSingleBuild(
        engine,
        fixturePath,
        fixtureName,
        options,
      );
      results[engine] = result;
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

  // If running in dual mode and both engines succeeded, compare results
  if (
    engineEnv === 'dual' &&
    results.js &&
    results.rust &&
    options.compareOutputs !== false
  ) {
    const comparison = compareBuilds(results.js, results.rust);
    generateParityReport(fixtureName, results.js, results.rust, comparison);
    return {
      jsResult: results.js,
      rustResult: results.rust,
      comparison,
    };
  }

  return {
    jsResult: results.js,
    rustResult: results.rust,
  };
}

async function runSingleBuild(
  engine: string,
  fixturePath: string,
  fixtureName: string,
  options: ParityOptions,
): Promise<BuildResult> {
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
    mode: options.mode || 'production',
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

  return {
    engine,
    fixtureName,
    bundleGraph,
    buildTime,
    bundles,
    outputDir,
  };
}
