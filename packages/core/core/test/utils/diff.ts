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
  diagnostics: {
    match: boolean;
    js: any[];
    rust: any[];
    diffs: string[];
  };
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
  const diagnostics = compareDiagnostics(
    jsResult.diagnostics,
    rustResult.diagnostics,
  );

  return {
    bundleCount,
    bundleTypes,
    buildTime,
    fileDifferences,
    contentDifferences,
    diagnostics,
  };
}

function compareDiagnostics(
  js: any[] | undefined,
  rust: any[] | undefined,
): {match: boolean; js: any[]; rust: any[]; diffs: string[]} {
  const jsDiags = normalizeDiagnostics(js || []);
  const rustDiags = normalizeDiagnostics(rust || []);

  // Sort to handle potential nondeterminism in error reporting order
  const sortFn = (a: any, b: any) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b));
  jsDiags.sort(sortFn);
  rustDiags.sort(sortFn);

  const diffs: string[] = [];
  const match = JSON.stringify(jsDiags) === JSON.stringify(rustDiags);

  if (!match) {
    if (jsDiags.length !== rustDiags.length) {
      diffs.push(
        `Diagnostic count mismatch: JS=${jsDiags.length}, Rust=${rustDiags.length}`,
      );
    }

    // Simple diff for now
    const maxlen = Math.max(jsDiags.length, rustDiags.length);
    for (let i = 0; i < maxlen; i++) {
      const j = jsDiags[i] ? JSON.stringify(jsDiags[i], null, 2) : 'undefined';
      const r = rustDiags[i]
        ? JSON.stringify(rustDiags[i], null, 2)
        : 'undefined';
      if (j !== r) {
        diffs.push(
          `Diagnostic mismatch at index ${i}:\nJS:\n${j}\nRust:\n${r}`,
        );
      }
    }
  }

  return {match, js: jsDiags, rust: rustDiags, diffs};
}

function normalizeDiagnostics(diags: any[]): any[] {
  return diags.map((d) => {
    const clone = JSON.parse(JSON.stringify(d));
    // Normalize stack traces and paths
    delete clone.stack; // Stacks will differ between engines
    if (clone.codeFrames) {
      clone.codeFrames.forEach((frame: any) => {
        if (frame.filePath) {
          frame.filePath = frame.filePath.replace(process.cwd(), '<ROOT>');
        }
      });
    }
    // Normalize origin if needed (sometimes Rust reports slightly different origin strings)
    // For now, keep strictly to see diffs
    return clone;
  });
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
