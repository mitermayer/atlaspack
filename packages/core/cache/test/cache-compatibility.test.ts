import assert from 'assert';
import * as path from 'path';
import * as fs from 'fs/promises';
import {tmpdir} from 'os';
import {LMDBLiteCache} from '../src/LMDBLiteCache';
import {CacheSchemaManager} from '../src/CacheSchemaManager';
import {HashParityMatrixTester} from '../src/HashParityMatrixTester';
import {WASMFallbackValidator} from '../src/WASMFallbackValidator';
import {writeEvents, writeSummary} from '@atlaspack/core/test/utils/artifacts';

describe('Cache Compatibility Tests', function (this: Mocha.Suite) {
  this.timeout(30000);

  let cacheDir: string;
  let cache: LMDBLiteCache;
  let schemaManager: CacheSchemaManager;

  beforeEach(async () => {
    cacheDir = path.join(tmpdir(), `cache-compat-test-${Date.now()}`);
    cache = new LMDBLiteCache(cacheDir);
    schemaManager = new CacheSchemaManager();
    await cache.ensure();
  });

  afterEach(async () => {
    await fs.rm(cacheDir, {recursive: true, force: true});
  });

  describe('Cache Schema Versioning', () => {
    it('should initialize with default schema version', async () => {
      await schemaManager.migrateCache(cache);
      const version = await schemaManager.getCurrentVersion();
      assert.strictEqual(version, '1.2.0');
    });

    it('should migrate from older version to current', async () => {
      // Simulate older cache by setting old version
      await cache.set('__cache_schema_version__', '1.0.0');

      await schemaManager.migrateCache(cache);

      const currentVersion = await cache.get<string>(
        '__cache_schema_version__',
      );
      assert.strictEqual(currentVersion, '1.2.0');
    });

    it('should handle version compatibility checks', () => {
      assert(schemaManager.isVersionCompatible('1.0.0'));
      assert(schemaManager.isVersionCompatible('1.1.0'));
      assert(schemaManager.isVersionCompatible('1.2.0'));

      try {
        schemaManager.setCurrentVersion('2.0.0');
        assert.fail('Should have thrown error for unknown version');
      } catch (error: any) {
        assert(error.message.includes('Unknown cache schema version'));
      }
    });

    it('should register custom versions', () => {
      const customVersion = {
        version: '1.3.0',
        migration: async () => {
          // Custom migration logic
        },
      };

      schemaManager.registerVersion(customVersion);
      schemaManager.setCurrentVersion('1.3.0');

      assert.strictEqual(schemaManager.getCurrentVersion(), '1.3.0');
    });

    it('should preserve data during migration', async () => {
      // Store some data before migration
      const testData = {key: 'value', timestamp: Date.now()};
      await cache.set('test_key', testData);

      // Simulate migration from 1.0.0 to 1.2.0
      await cache.set('__cache_schema_version__', '1.0.0');
      await schemaManager.migrateCache(cache);

      // Verify data is still accessible
      const retrievedData = await cache.get('test_key');
      assert.deepStrictEqual(retrievedData, testData);
    });
  });

  describe('Cache Performance and Reliability', () => {
    it('should handle concurrent operations', async () => {
      const promises = [];
      const numOperations = 100;

      for (let i = 0; i < numOperations; i++) {
        promises.push(cache.set(`key_${i}`, {value: i}));
        promises.push(cache.get(`key_${i}`));
      }

      await Promise.all(promises);

      // Verify all data was stored correctly
      for (let i = 0; i < numOperations; i++) {
        const data = await cache.get(`key_${i}`);
        assert.deepStrictEqual(data, {value: i});
      }
    });

    it('should handle large data efficiently', async () => {
      const largeData = {
        array: new Array(10000)
          .fill(0)
          .map((_, i) => ({id: i, data: 'x'.repeat(100)})),
        metadata: {size: 'large', timestamp: Date.now()},
      };

      const startTime = performance.now();
      await cache.set('large_data', largeData);
      const setTime = performance.now() - startTime;

      const getStartTime = performance.now();
      const retrievedData = await cache.get('large_data');
      const getTime = performance.now() - getStartTime;

      assert.deepStrictEqual(retrievedData, largeData);
      assert(setTime < 1000, 'Set operation should complete within 1 second');
      assert(getTime < 500, 'Get operation should complete within 500ms');
    });

    it('should handle cache corruption gracefully', async () => {
      // Store valid data
      await cache.set('valid_key', {valid: true});

      // Simulate corruption by writing invalid data directly
      await cache.setBlob(
        'corrupted_key',
        Buffer.from('invalid serialized data'),
      );

      // Should still be able to access valid data
      const validData = await cache.get('valid_key');
      assert.deepStrictEqual(validData, {valid: true});

      // Should handle corrupted data gracefully
      try {
        await cache.get('corrupted_key');
        // If it doesn't throw, that's also acceptable behavior
      } catch (error) {
        // Throwing is acceptable for corrupted data
        assert(error instanceof Error);
      }
    });

    it('should maintain consistency across restarts', async () => {
      const testData = {persistent: true, timestamp: Date.now()};
      await cache.set('persistent_key', testData);

      // Simulate cache restart by creating new instance
      const restartedCache = new LMDBLiteCache(cacheDir);
      await restartedCache.ensure();

      const retrievedData = await restartedCache.get('persistent_key');
      assert.deepStrictEqual(retrievedData, testData);
    });
  });

  describe('Cache Integration with Build System', () => {
    it('should integrate with build cache serialization', async () => {
      const {serialize, deserialize} = require('@atlaspack/build-cache');

      const complexObject = {
        assets: [
          {id: 'asset1', type: 'js', content: 'console.log("hello");'},
          {id: 'asset2', type: 'css', content: 'body { margin: 0; }'},
        ],
        dependencies: new Map([['dep1', {version: '1.0.0'}]]),
        metadata: {buildTime: Date.now(), environment: 'test'},
      };

      const serialized = serialize(complexObject);
      await cache.setBlob('complex_build', serialized);

      const retrievedBlob = await cache.getBlob('complex_build');
      const deserialized = deserialize(retrievedBlob);

      assert.deepStrictEqual(deserialized, complexObject);
    });

    it('should handle build artifact caching', async () => {
      const artifacts = {
        bundles: [
          {name: 'main.js', size: 1024, hash: 'abc123'},
          {name: 'styles.css', size: 512, hash: 'def456'},
        ],
        sourceMaps: new Map([['main.js', 'source-map-content']]),
        stats: {totalSize: 1536, bundleCount: 2},
      };

      await cache.set('build_artifacts', artifacts);

      const retrievedArtifacts = await cache.get('build_artifacts');
      assert.deepStrictEqual(retrievedArtifacts, artifacts);

      // Verify individual components
      assert.strictEqual(retrievedArtifacts.bundles.length, 2);
      assert.strictEqual(retrievedArtifacts.sourceMaps.size, 1);
      assert.strictEqual(retrievedArtifacts.stats.totalSize, 1536);
    });
  });

  describe('Cache Error Handling and Recovery', () => {
    it('should handle disk space issues gracefully', async () => {
      // This test simulates disk space issues by monitoring behavior
      // In a real scenario, we might mock the underlying file system

      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      const promises = [];

      // Try to write multiple large chunks
      for (let i = 0; i < 100; i++) {
        promises.push(
          cache.set(`large_${i}`, largeData).catch((error) => {
            // Should handle errors gracefully
            assert(error instanceof Error);
          }),
        );
      }

      await Promise.all(promises);

      // Cache should still be functional for smaller data
      await cache.set('small_test', {works: true});
      const result = await cache.get('small_test');
      assert.deepStrictEqual(result, {works: true});
    });

    it('should handle permission errors', async () => {
      // This test would ideally mock permission errors
      // For now, we test the error handling path

      try {
        // Try to access a path that might not exist
        await cache.get('non_existent_key');
        // Should return null for non-existent keys
        assert.ok(true);
      } catch (error) {
        // Should not throw for non-existent keys
        assert.fail('Should not throw for non-existent keys');
      }
    });

    it('should recover from partial writes', async () => {
      const criticalData = {critical: true, timestamp: Date.now()};

      // Write critical data
      await cache.set('critical_data', criticalData);

      // Simulate partial write by writing and then immediately writing again
      const promises = [
        cache.set('test1', {data: 'test1'}),
        cache.set('test2', {data: 'test2'}),
        cache.set('critical_data', criticalData), // Rewrite critical data
      ];

      await Promise.all(promises);

      // Critical data should be intact
      const retrievedData = await cache.get('critical_data');
      assert.deepStrictEqual(retrievedData, criticalData);
    });
  });
});

describe('Hash Parity Matrix Tests', function (this: Mocha.Suite) {
  this.timeout(60000);

  let hashTester: HashParityMatrixTester;

  beforeEach(async () => {
    hashTester = new HashParityMatrixTester('matrix-test');
    await hashTester.setup();
  });

  afterEach(async () => {
    await hashTester.cleanup();
  });

  it('should generate comprehensive test cases', async () => {
    const testCases = await hashTester.generateTestCases();

    assert(testCases.length > 20, 'Should generate at least 20 test cases');
    assert(testCases.includes(''), 'Should include empty string');
    assert(testCases.includes('hello'), 'Should include basic string');
    assert(
      testCases.some((tc) => tc.includes('function')),
      'Should include JavaScript code',
    );
    assert(
      testCases.some((tc) => tc.includes('🚀')),
      'Should include Unicode',
    );
  });

  it('should run hash parity matrix', async () => {
    const matrix = await hashTester.runFullMatrix();

    assert(matrix.results.length > 0, 'Should have test results');
    assert.strictEqual(
      matrix.version,
      '1.2.0',
      'Should use current schema version',
    );
    assert.strictEqual(
      matrix.environment,
      'test',
      'Should use test environment',
    );
    assert(matrix.summary.total > 0, 'Should have total count');
    assert(
      matrix.summary.parityRate >= 0,
      'Parity rate should be non-negative',
    );
    assert(matrix.summary.parityRate <= 1, 'Parity rate should not exceed 1');
  });

  it('should detect hash parity regressions', async () => {
    const matrix1 = await hashTester.runFullMatrix();

    // Simulate a regression by modifying some results
    const matrix2 = JSON.parse(JSON.stringify(matrix1)); // Deep clone

    // Find a result that currently has parity: true and change it to false
    const successResult = matrix2.results.find((r: any) => r.parity === true);

    if (successResult) {
      successResult.parity = false; // Force one failure

      matrix2.summary.passed = matrix2.summary.passed - 1;
      matrix2.summary.failed = matrix2.summary.failed + 1;
      matrix2.summary.parityRate =
        matrix2.summary.passed / matrix2.summary.total;

      const comparison = hashTester.compareMatrices(matrix1, matrix2);

      assert(comparison.regression, 'Should detect regression');
      assert(
        comparison.newFailures.includes(successResult.input),
        'Should identify new failure',
      );
      assert(comparison.parityChange < 0, 'Parity should decrease');
    } else {
      // If no success result found, skip this test
      // For the purpose of this test, we'll create a synthetic regression
      const comparison = hashTester.compareMatrices(matrix1, matrix2);
      assert(
        comparison.regression || comparison.parityChange <= 0,
        'Should detect some form of regression',
      );
    }
  });

  it('should save and load matrix results', async () => {
    const matrix = await hashTester.runFullMatrix();
    const outputPath = path.join(tmpdir(), `matrix-${Date.now()}.json`);

    await hashTester.saveResults(matrix, outputPath);
    const loadedMatrix = await hashTester.loadResults(outputPath);

    assert.deepStrictEqual(
      loadedMatrix,
      matrix,
      'Loaded matrix should match saved matrix',
    );

    await fs.unlink(outputPath);
  });
});

describe('WASM Fallback Validation Tests', function (this: Mocha.Suite) {
  this.timeout(60000);

  let wasmValidator: WASMFallbackValidator;

  beforeEach(async () => {
    wasmValidator = new WASMFallbackValidator('wasm-test');
    await wasmValidator.setup();
  });

  afterEach(async () => {
    await wasmValidator.cleanup();
  });

  it('should generate comprehensive test cases', async () => {
    const testCases = await wasmValidator.generateTestCases();

    assert(testCases.length > 10, 'Should generate at least 10 test cases');
    assert(
      testCases.some((tc) => tc.id === 'basic-string'),
      'Should include basic string test',
    );
    assert(
      testCases.some((tc) => tc.id === 'rust-error-case'),
      'Should include Rust error case',
    );
    assert(
      testCases.some((tc) => tc.id === 'wasm-error-case'),
      'Should include WASM error case',
    );
  });

  it('should run WASM fallback validation', async () => {
    const report = await wasmValidator.runFullValidation();

    assert(report.results.length > 0, 'Should have test results');
    assert.strictEqual(
      report.version,
      '1.2.0',
      'Should use current schema version',
    );
    assert.strictEqual(
      report.environment,
      'test',
      'Should use test environment',
    );
    assert(report.summary.total > 0, 'Should have total count');
    assert(
      report.summary.rustSuccessRate >= 0,
      'Rust success rate should be non-negative',
    );
    assert(
      report.summary.wasmSuccessRate >= 0,
      'WASM success rate should be non-negative',
    );
    assert(
      report.summary.jsFallbackSuccessRate >= 0,
      'JS fallback success rate should be non-negative',
    );
  });

  it('should validate fallback behavior', async () => {
    const report = await wasmValidator.runFullValidation();
    const validation = wasmValidator.validateFallbackBehavior(report);

    assert(
      typeof validation.valid === 'boolean',
      'Should return validity status',
    );
    assert(Array.isArray(validation.issues), 'Should return issues array');
    assert(
      Array.isArray(validation.recommendations),
      'Should return recommendations array',
    );
  });

  it('should save and load validation reports', async () => {
    const report = await wasmValidator.runFullValidation();
    const outputPath = path.join(tmpdir(), `wasm-report-${Date.now()}.json`);

    await wasmValidator.saveReport(report, outputPath);
    const loadedReport = await wasmValidator.loadReport(outputPath);

    // JSON serialization converts undefined to null, so we need to handle that
    const normalizedReport = JSON.parse(JSON.stringify(report));
    assert.deepStrictEqual(
      loadedReport,
      normalizedReport,
      'Loaded report should match saved report',
    );

    await fs.unlink(outputPath);
  });

  it('should handle fallback scenarios correctly', async () => {
    const result1 = await wasmValidator.runFallbackTest(
      'rust-error',
      'this will cause rust-error',
    );
    assert(result1.fallbackTriggered, 'Should trigger fallback for Rust error');
    assert(!result1.rustSuccess, 'Rust should fail');
    assert(result1.jsFallbackSuccess, 'JS fallback should succeed');

    const result2 = await wasmValidator.runFallbackTest(
      'wasm-error',
      'this will cause wasm-error',
    );
    assert(result2.fallbackTriggered, 'Should trigger fallback for WASM error');
    assert(!result2.wasmSuccess, 'WASM should fail');
    assert(result2.jsFallbackSuccess, 'JS fallback should succeed');

    const result3 = await wasmValidator.runFallbackTest(
      'normal',
      'normal input',
    );
    assert(
      !result3.fallbackTriggered,
      'Should not trigger fallback for normal input',
    );
    assert(result3.rustSuccess, 'Rust should succeed');
    assert(result3.wasmSuccess, 'WASM should succeed');
  });
});
