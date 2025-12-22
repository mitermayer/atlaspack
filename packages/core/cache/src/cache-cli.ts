#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import {tmpdir} from 'os';
import {LMDBLiteCache} from '../src/LMDBLiteCache';
import {CacheSchemaManager} from '../src/CacheSchemaManager';
import {HashParityMatrixTester} from '../src/HashParityMatrixTester';
import {WASMFallbackValidator} from '../src/WASMFallbackValidator';
import {writeEvents, writeSummary} from './utils/artifacts';

/* eslint-disable no-console */

interface CommandOptions {
  output?: string;
  verbose?: boolean;
  compare?: string;
  threshold?: number;
}

async function runCacheValidation(options: CommandOptions = {}): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('🔍 Running Cache Compatibility Validation...\n');

  // 1. Schema Versioning Tests
  console.log('📋 Testing Cache Schema Versioning...');
  const schemaManager = new CacheSchemaManager();
  const cacheDir = path.join(tmpdir(), `cache-validation-${Date.now()}`);
  const cache = new LMDBLiteCache(cacheDir);

  try {
    await cache.ensure();
    await schemaManager.migrateCache(cache);

    const currentVersion = schemaManager.getCurrentVersion();
    console.log(`✅ Current schema version: ${currentVersion}`);

    // Test version compatibility
    const testVersions = ['1.0.0', '1.1.0', '1.2.0'];
    for (const version of testVersions) {
      const compatible = schemaManager.isVersionCompatible(version);
      console.log(
        `   ${version}: ${compatible ? '✅ Compatible' : '❌ Incompatible'}`,
      );
    }
  } catch (error) {
    console.error('❌ Schema versioning failed:', error);
    throw error;
  } finally {
    await cache.clear();
    await fs.rm(cacheDir, {recursive: true, force: true});
  }

  // 2. Hash Parity Matrix Tests
  console.log('\n🔢 Running Hash Parity Matrix Tests...');
  const hashTester = new HashParityMatrixTester('validation');

  try {
    await hashTester.setup();
    const matrix = await hashTester.runFullMatrix();

    console.log(`✅ Total tests: ${matrix.summary.total}`);
    console.log(`✅ Passed: ${matrix.summary.passed}`);
    console.log(`❌ Failed: ${matrix.summary.failed}`);
    console.log(
      `📊 Parity Rate: ${(matrix.summary.parityRate * 100).toFixed(2)}%`,
    );

    if (options.output) {
      const matrixPath = path.join(options.output, 'hash-parity-matrix.json');
      await hashTester.saveResults(matrix, matrixPath);
      console.log(`💾 Matrix saved to: ${matrixPath}`);
    }

    // Compare with previous results if requested
    if (options.compare) {
      try {
        const previousMatrix = await hashTester.loadResults(options.compare);
        const comparison = hashTester.compareMatrices(previousMatrix, matrix);

        console.log('\n📈 Comparison with previous results:');
        console.log(
          `   Regression: ${comparison.regression ? '❌ Yes' : '✅ No'}`,
        );
        console.log(`   New Failures: ${comparison.newFailures.length}`);
        console.log(`   Fixed Issues: ${comparison.fixedIssues.length}`);
        console.log(
          `   Parity Change: ${(comparison.parityChange * 100).toFixed(2)}%`,
        );

        if (comparison.regression) {
          console.log('⚠️  Regression detected!');
          comparison.newFailures.forEach((failure) => {
            console.log(`   - ${failure}`);
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  Could not compare with previous results: ${msg}`);
      }
    }

    // Check threshold
    if (options.threshold && matrix.summary.parityRate < options.threshold) {
      throw new Error(
        `Hash parity rate ${(matrix.summary.parityRate * 100).toFixed(2)}% is below threshold ${(options.threshold * 100).toFixed(2)}%`,
      );
    }
  } catch (error) {
    console.error('❌ Hash parity matrix failed:', error);
    throw error;
  } finally {
    await hashTester.cleanup();
  }

  // 3. WASM Fallback Validation
  console.log('\n🔄 Running WASM Fallback Validation...');
  const wasmValidator = new WASMFallbackValidator('validation');

  try {
    await wasmValidator.setup();
    const report = await wasmValidator.runFullValidation();

    console.log(`✅ Total tests: ${report.summary.total}`);
    console.log(
      `🦀 Rust Success Rate: ${(report.summary.rustSuccessRate * 100).toFixed(2)}%`,
    );
    console.log(
      `🕸️  WASM Success Rate: ${(report.summary.wasmSuccessRate * 100).toFixed(2)}%`,
    );
    console.log(
      `📜 JS Fallback Success Rate: ${(report.summary.jsFallbackSuccessRate * 100).toFixed(2)}%`,
    );
    console.log(
      `🔄 Fallback Rate: ${(report.summary.fallbackRate * 100).toFixed(2)}%`,
    );

    console.log('\n⏱️  Performance (ms):');
    console.log(
      `   Rust: ${report.summary.averagePerformance.rustTime.toFixed(2)}`,
    );
    console.log(
      `   WASM: ${report.summary.averagePerformance.wasmTime.toFixed(2)}`,
    );
    console.log(
      `   JS Fallback: ${report.summary.averagePerformance.jsFallbackTime.toFixed(2)}`,
    );

    if (options.output) {
      const reportPath = path.join(options.output, 'wasm-fallback-report.json');
      await wasmValidator.saveReport(report, reportPath);
      console.log(`💾 Report saved to: ${reportPath}`);
    }

    // Validate fallback behavior
    const validation = wasmValidator.validateFallbackBehavior(report);
    if (!validation.valid) {
      console.log('\n⚠️  Fallback validation issues:');
      validation.issues.forEach((issue) => console.log(`   - ${issue}`));
    }

    if (validation.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      validation.recommendations.forEach((rec) => console.log(`   - ${rec}`));
    }
  } catch (error) {
    console.error('❌ WASM fallback validation failed:', error);
    throw error;
  } finally {
    await wasmValidator.cleanup();
  }

  console.log('\n🎉 Cache compatibility validation completed successfully!');
}

async function runCacheMigration(
  cacheDir: string,
  targetVersion?: string,
): Promise<void> {
  console.log(`🔄 Running cache migration for: ${cacheDir}`);

  if (
    !(await fs
      .access(cacheDir)
      .then(() => true)
      .catch(() => false))
  ) {
    throw new Error(`Cache directory does not exist: ${cacheDir}`);
  }

  const cache = new LMDBLiteCache(cacheDir);
  const schemaManager = new CacheSchemaManager();

  try {
    await cache.ensure();

    const currentVersion = await (schemaManager as any).getStoredVersion(cache);
    console.log(`📋 Current version: ${currentVersion}`);

    if (targetVersion) {
      schemaManager.setCurrentVersion(targetVersion);
      console.log(`🎯 Target version: ${targetVersion}`);
    }

    await schemaManager.migrateCache(cache);

    const newVersion = await (schemaManager as any).getStoredVersion(cache);
    console.log(`✅ Migration completed. New version: ${newVersion}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function runCacheDiagnostics(cacheDir: string): Promise<void> {
  console.log(`🔍 Running cache diagnostics for: ${cacheDir}`);

  if (
    !(await fs
      .access(cacheDir)
      .then(() => true)
      .catch(() => false))
  ) {
    throw new Error(`Cache directory does not exist: ${cacheDir}`);
  }

  const cache = new LMDBLiteCache(cacheDir);
  const schemaManager = new CacheSchemaManager();

  try {
    await cache.ensure();

    // Get cache info
    const keys = Array.from(cache.keys());
    const version = await (schemaManager as any).getStoredVersion(cache);

    console.log(`📊 Cache Statistics:`);
    console.log(`   Version: ${version}`);
    console.log(`   Total keys: ${keys.length}`);
    console.log(`   Directory: ${cacheDir}`);

    // Sample some keys for analysis
    const sampleSize = Math.min(10, keys.length);
    const sampleKeys = keys.slice(0, sampleSize);

    console.log(`\n🔑 Sample keys (${sampleSize}/${keys.length}):`);
    for (const key of sampleKeys) {
      try {
        const data = await cache.get(key);
        const size = JSON.stringify(data).length;
        console.log(`   ${key}: ${size} bytes`);
      } catch (error) {
        console.log(`   ${key}: ❌ Error reading`);
      }
    }

    // Check schema compatibility
    const compatible = schemaManager.isVersionCompatible(version);
    console.log(
      `\n✅ Schema compatibility: ${compatible ? 'Compatible' : 'Incompatible'}`,
    );

    if (!compatible) {
      console.log('💡 Consider running cache migration to update schema');
    }
  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  const options: CommandOptions = {};

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg.startsWith('--compare=')) {
      options.compare = arg.split('=')[1];
    } else if (arg.startsWith('--threshold=')) {
      options.threshold = parseFloat(arg.split('=')[1]);
    }
  }

  try {
    switch (command) {
      case 'validate':
        await runCacheValidation(options);
        break;

      case 'migrate': {
        const cacheDir = args[1];
        const targetVersion = args
          .find((arg) => arg.startsWith('--version='))
          ?.split('=')[1];
        if (!cacheDir) {
          console.error('❌ Cache directory required for migrate command');
          process.exit(1);
        }
        await runCacheMigration(cacheDir, targetVersion);
        break;
      }

      case 'diagnose': {
        const diagnoseDir = args[1];
        if (!diagnoseDir) {
          console.error('❌ Cache directory required for diagnose command');
          process.exit(1);
        }
        await runCacheDiagnostics(diagnoseDir);
        break;
      }

      default:
        console.log(`
Cache Compatibility Tools

Usage:
  node cache-cli.js <command> [options]

Commands:
  validate                    Run full cache compatibility validation
  migrate <cache-dir>         Migrate cache to latest schema version
  diagnose <cache-dir>        Run cache diagnostics

Options:
  --output=<dir>             Save artifacts to specified directory
  --compare=<file>           Compare hash parity with previous results
  --threshold=<rate>         Minimum acceptable hash parity rate (0-1)
  --version=<version>        Target version for migration
  --verbose                   Enable verbose output

Examples:
  node cache-cli.js validate --output=./artifacts --threshold=0.95
  node cache-cli.js migrate ./.parcel-cache --version=1.2.0
  node cache-cli.js diagnose ./.parcel-cache
        `);
        process.exit(1);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Command failed:', msg);
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {runCacheValidation, runCacheMigration, runCacheDiagnostics};
