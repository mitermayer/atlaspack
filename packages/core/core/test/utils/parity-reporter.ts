import fs from 'fs';
import path from 'path';
import {BuildResult} from './parity-runner';
import {ComparisonResult} from './diff';

const PROJECT_ROOT = path.resolve(__dirname, '../../../../../');

export interface ParityReport {
  fixtureName: string;
  timestamp: string;
  jsResult: {
    bundleCount: number;
    buildTime: number;
    bundles: Array<{filePath: string; type: string; id: string}>;
  };
  rustResult: {
    bundleCount: number;
    buildTime: number;
    bundles: Array<{filePath: string; type: string; id: string}>;
  };
  comparison: ComparisonResult;
  summary: {
    passed: boolean;
    issues: string[];
  };
}

export function generateParityReport(
  fixtureName: string,
  jsResult: BuildResult,
  rustResult: BuildResult,
  comparison: ComparisonResult,
): void {
  const report: ParityReport = {
    fixtureName,
    timestamp: new Date().toISOString(),
    jsResult: {
      bundleCount: jsResult.bundles.length,
      buildTime: jsResult.buildTime,
      bundles: jsResult.bundles,
    },
    rustResult: {
      bundleCount: rustResult.bundles.length,
      buildTime: rustResult.buildTime,
      bundles: rustResult.bundles,
    },
    comparison,
    summary: generateSummary(comparison),
  };

  const reportDir = path.join(PROJECT_ROOT, '.parcel-cache/parity/reports');
  const reportPath = path.join(reportDir, `${fixtureName}.json`);

  // Ensure directory exists
  fs.mkdirSync(reportDir, {recursive: true});

  // Write report
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

  // Log summary to console
  logReportSummary(report);
}

function generateSummary(comparison: ComparisonResult): {
  passed: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!comparison.bundleCount.match) {
    issues.push(
      `Bundle count mismatch: JS=${comparison.bundleCount.js}, Rust=${comparison.bundleCount.rust}`,
    );
  }

  if (!comparison.bundleTypes.match) {
    issues.push('Bundle types mismatch between engines');
  }

  if (comparison.fileDifferences.length > 0) {
    const missingFiles = comparison.fileDifferences.filter(
      (d) => d.existsIn.length === 1,
    );
    if (missingFiles.length > 0) {
      issues.push(`${missingFiles.length} files exist in only one engine`);
    }
  }

  if (comparison.contentDifferences.length > 0) {
    issues.push(
      `${comparison.contentDifferences.length} files have different content`,
    );
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function logReportSummary(report: ParityReport): void {
  // eslint-disable-next-line no-console
  console.log(`\n=== Parity Report for ${report.fixtureName} ===`);

  if (report.summary.passed) {
    // eslint-disable-next-line no-console
    console.log('✅ PASSED - No differences detected');
  } else {
    // eslint-disable-next-line no-console
    console.log('❌ FAILED - Differences detected:');
    report.summary.issues.forEach((issue) => {
      // eslint-disable-next-line no-console
      console.log(`  - ${issue}`);
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Bundle Count: JS=${report.jsResult.bundleCount}, Rust=${report.rustResult.bundleCount}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Build Time: JS=${report.jsResult.buildTime}ms, Rust=${report.rustResult.buildTime}ms`,
  );

  if (report.comparison.buildTime.ratio > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `Performance Ratio (JS/Rust): ${report.comparison.buildTime.ratio.toFixed(2)}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `Report saved to: .parcel-cache/parity/reports/${report.fixtureName}.json`,
  );
  // eslint-disable-next-line no-console
  console.log('=====================================\n');
}

export function loadParityReport(fixtureName: string): ParityReport | null {
  const reportPath = path.join(
    PROJECT_ROOT,
    '.parcel-cache/parity/reports',
    `${fixtureName}.json`,
  );

  try {
    if (fs.existsSync(reportPath)) {
      const content = fs.readFileSync(reportPath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    // Ignore errors
  }

  return null;
}
