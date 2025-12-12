import fs from 'fs';
import path from 'path';
import {BuildResult} from './parity-runner';

export interface ComparisonResult {
  bundleCount: {
    js: number;
    rust: number;
    match: boolean;
  };
  bundleTypes: {
    js: Record<string, number>;
    rust: Record<string, number>;
    match: boolean;
  };
  buildTime: {
    js: number;
    rust: number;
    ratio: number;
  };
  fileDifferences: Array<{
    filePath: string;
    existsIn: ('js' | 'rust')[];
    sizeDiff?: number;
  }>;
  contentDifferences: Array<{
    filePath: string;
    differences: string[];
  }>;
}

export function compareBuilds(
  jsResult: BuildResult,
  rustResult: BuildResult,
): ComparisonResult {
  const bundleCount = {
    js: jsResult.bundles.length,
    rust: rustResult.bundles.length,
    match: jsResult.bundles.length === rustResult.bundles.length,
  };

  const bundleTypes = {
    js: getBundleTypes(jsResult.bundles),
    rust: getBundleTypes(rustResult.bundles),
    match: false,
  };

  bundleTypes.match =
    JSON.stringify(bundleTypes.js) === JSON.stringify(bundleTypes.rust);

  const buildTime = {
    js: jsResult.buildTime,
    rust: rustResult.buildTime,
    ratio:
      rustResult.buildTime > 0 ? jsResult.buildTime / rustResult.buildTime : 0,
  };

  const fileDifferences = compareFileLists(jsResult, rustResult);
  const contentDifferences = compareFileContents(jsResult, rustResult);

  return {
    bundleCount,
    bundleTypes,
    buildTime,
    fileDifferences,
    contentDifferences,
  };
}

function getBundleTypes(
  bundles: Array<{type: string}>,
): Record<string, number> {
  const types: Record<string, number> = {};
  for (const bundle of bundles) {
    types[bundle.type] = (types[bundle.type] || 0) + 1;
  }
  return types;
}

function compareFileLists(
  jsResult: BuildResult,
  rustResult: BuildResult,
): Array<{
  filePath: string;
  existsIn: ('js' | 'rust')[];
  sizeDiff?: number;
}> {
  const jsFiles = new Map(
    jsResult.bundles.map((b) => [path.basename(b.filePath), b]),
  );
  const rustFiles = new Map(
    rustResult.bundles.map((b) => [path.basename(b.filePath), b]),
  );

  const allFiles = new Set([...jsFiles.keys(), ...rustFiles.keys()]);
  const differences: Array<{
    filePath: string;
    existsIn: ('js' | 'rust')[];
    sizeDiff?: number;
  }> = [];

  for (const fileName of allFiles) {
    const jsBundle = jsFiles.get(fileName);
    const rustBundle = rustFiles.get(fileName);

    const existsIn: ('js' | 'rust')[] = [];
    if (jsBundle) existsIn.push('js');
    if (rustBundle) existsIn.push('rust');

    const diff: any = {filePath: fileName, existsIn};

    if (jsBundle && rustBundle) {
      const jsSize = getFileSize(jsBundle.filePath);
      const rustSize = getFileSize(rustBundle.filePath);
      if (jsSize !== rustSize) {
        diff.sizeDiff = jsSize - rustSize;
      }
    }

    differences.push(diff);
  }

  return differences;
}

function compareFileContents(
  jsResult: BuildResult,
  rustResult: BuildResult,
): Array<{
  filePath: string;
  differences: string[];
}> {
  const differences: Array<{filePath: string; differences: string[]}> = [];

  // Find common files to compare
  const jsFiles = new Map(
    jsResult.bundles.map((b) => [path.basename(b.filePath), b]),
  );
  const rustFiles = new Map(
    rustResult.bundles.map((b) => [path.basename(b.filePath), b]),
  );

  for (const [fileName, jsBundle] of jsFiles) {
    const rustBundle = rustFiles.get(fileName);
    if (!rustBundle) continue;

    const jsContent = getFileContent(jsBundle.filePath);
    const rustContent = getFileContent(rustBundle.filePath);

    if (jsContent && rustContent && jsContent !== rustContent) {
      const diffs = analyzeContentDifferences(jsContent, rustContent);
      if (diffs.length > 0) {
        differences.push({
          filePath: fileName,
          differences: diffs,
        });
      }
    }
  }

  return differences;
}

function getFileSize(filePath: string): number {
  try {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      return fs.statSync(fullPath).size;
    }
  } catch (err) {
    // Ignore errors
  }
  return 0;
}

function getFileContent(filePath: string): string | null {
  try {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
  } catch (err) {
    // Ignore errors
  }
  return null;
}

function analyzeContentDifferences(
  jsContent: string,
  rustContent: string,
): string[] {
  const differences: string[] = [];

  // Simple line-by-line comparison
  const jsLines = jsContent.split('\n');
  const rustLines = rustContent.split('\n');
  const maxLines = Math.max(jsLines.length, rustLines.length);

  let diffCount = 0;
  for (let i = 0; i < maxLines; i++) {
    const jsLine = jsLines[i] || '';
    const rustLine = rustLines[i] || '';

    if (jsLine.trim() !== rustLine.trim()) {
      diffCount++;
      if (diffCount <= 5) {
        // Limit to first 5 differences
        differences.push(`Line ${i + 1}: JS="${jsLine}" vs Rust="${rustLine}"`);
      }
    }
  }

  if (diffCount > 5) {
    differences.push(`... and ${diffCount - 5} more line differences`);
  }

  return differences;
}
