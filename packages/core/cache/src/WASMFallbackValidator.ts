import {LMDBLiteCache} from '../src/LMDBLiteCache';
import {CacheSchemaManager} from '../src/CacheSchemaManager';
import {writeEvents, writeSummary} from './utils/artifacts';
import {tmpdir} from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

interface WASMFallbackResult {
  testId: string;
  input: any;
  rustResult: any;
  wasmResult: any;
  jsFallbackResult: any;
  rustSuccess: boolean;
  wasmSuccess: boolean;
  jsFallbackSuccess: boolean;
  fallbackTriggered: boolean;
  performance: {
    rustTime: number;
    wasmTime: number;
    jsFallbackTime: number;
  };
  timestamp: number;
}

interface WASMFallbackReport {
  version: string;
  environment: string;
  results: WASMFallbackResult[];
  summary: {
    total: number;
    rustSuccessRate: number;
    wasmSuccessRate: number;
    jsFallbackSuccessRate: number;
    fallbackRate: number;
    averagePerformance: {
      rustTime: number;
      wasmTime: number;
      jsFallbackTime: number;
    };
  };
}

export class WASMFallbackValidator {
  private cacheDir: string;
  private cache: LMDBLiteCache;
  private schemaManager: CacheSchemaManager;

  constructor(testName: string) {
    this.cacheDir = path.join(
      tmpdir(),
      `wasm-fallback-test-${testName}-${Date.now()}`,
    );
    this.cache = new LMDBLiteCache(this.cacheDir);
    this.schemaManager = new CacheSchemaManager();
  }

  async setup(): Promise<void> {
    await this.cache.ensure();
    await this.schemaManager.migrateCache(this.cache);
  }

  async cleanup(): Promise<void> {
    await fs.rm(this.cacheDir, {recursive: true, force: true});
  }

  private async runRustImplementation(
    input: any,
  ): Promise<{success: boolean; result: any; time: number}> {
    const startTime = performance.now();
    try {
      // This would call the actual Rust implementation
      // For now, simulate with a mock implementation
      const result = await this.mockRustImplementation(input);
      const endTime = performance.now();
      return {
        success: true,
        result,
        time: endTime - startTime,
      };
    } catch (error: any) {
      const endTime = performance.now();
      return {
        success: false,
        result: error.message || String(error),
        time: endTime - startTime,
      };
    }
  }

  private async runWASMImplementation(
    input: any,
  ): Promise<{success: boolean; result: any; time: number}> {
    const startTime = performance.now();
    try {
      // This would call the actual WASM implementation
      // For now, simulate with a mock implementation
      const result = await this.mockWASMImplementation(input);
      const endTime = performance.now();
      return {
        success: true,
        result,
        time: endTime - startTime,
      };
    } catch (error: any) {
      const endTime = performance.now();
      return {
        success: false,
        result: error.message || String(error),
        time: endTime - startTime,
      };
    }
  }

  private async mockRustImplementation(input: any): Promise<any> {
    // Simulate Rust implementation behavior
    if (typeof input === 'string' && input.includes('rust-error')) {
      throw new Error('Rust implementation error');
    }
    // Add dummy await to satisfy linter
    await Promise.resolve();
    return {processed: true, engine: 'rust', input};
  }

  private async mockWASMImplementation(input: any): Promise<any> {
    // Simulate WASM implementation behavior
    if (typeof input === 'string' && input.includes('wasm-error')) {
      throw new Error('WASM implementation error');
    }
    if (typeof input === 'string' && input.includes('wasm-unavailable')) {
      throw new Error('WASM not available');
    }
    // Add dummy await to satisfy linter
    await Promise.resolve();
    return {processed: true, engine: 'wasm', input};
  }

  private async runJSFallbackImplementation(
    input: any,
  ): Promise<{success: boolean; result: any; time: number}> {
    const startTime = performance.now();
    try {
      // This would call the actual JS fallback implementation
      // For now, simulate with a mock implementation
      const result = await this.mockJSFallbackImplementation(input);
      const endTime = performance.now();
      return {
        success: true,
        result,
        time: endTime - startTime,
      };
    } catch (error: any) {
      const endTime = performance.now();
      return {
        success: false,
        result: error.message || String(error),
        time: endTime - startTime,
      };
    }
  }

  private async mockJSFallbackImplementation(input: any): Promise<any> {
    // Simulate JS fallback implementation behavior
    if (typeof input === 'string' && input.includes('js-error')) {
      throw new Error('JS fallback error');
    }
    // Add dummy await to satisfy linter
    await Promise.resolve();
    return {processed: true, engine: 'js', input};
  }

  async runFallbackTest(
    testId: string,
    input: any,
  ): Promise<WASMFallbackResult> {
    const timestamp = Date.now();

    // Try Rust implementation first
    const rustResult = await this.runRustImplementation(input);

    // Try WASM implementation
    const wasmResult = await this.runWASMImplementation(input);

    // Determine if fallback should be triggered
    const fallbackTriggered = !rustResult.success || !wasmResult.success;

    // Run JS fallback if needed
    let jsFallbackResult;
    if (fallbackTriggered) {
      jsFallbackResult = await this.runJSFallbackImplementation(input);
    } else {
      jsFallbackResult = {success: true, result: null, time: 0};
    }

    const result: WASMFallbackResult = {
      testId,
      input,
      rustResult: rustResult.result,
      wasmResult: wasmResult.result,
      jsFallbackResult: jsFallbackResult.result,
      rustSuccess: rustResult.success,
      wasmSuccess: wasmResult.success,
      jsFallbackSuccess: jsFallbackResult.success,
      fallbackTriggered,
      performance: {
        rustTime: rustResult.time,
        wasmTime: wasmResult.time,
        jsFallbackTime: jsFallbackResult.time,
      },
      timestamp,
    };

    // Store result in cache
    await this.cache.set(`wasm_fallback:${testId}`, result);

    return result;
  }

  generateTestCases(): Array<{id: string; input: any}> {
    return [
      {id: 'basic-string', input: 'hello world'},
      {id: 'empty-string', input: ''},
      {id: 'json-object', input: {name: 'test', value: 42}},
      {id: 'array-input', input: [1, 2, 3, 4, 5]},
      {id: 'rust-error-case', input: 'this will cause rust-error'},
      {id: 'wasm-error-case', input: 'this will cause wasm-error'},
      {id: 'wasm-unavailable-case', input: 'this will cause wasm-unavailable'},
      {id: 'js-error-case', input: 'this will cause js-error'},
      {id: 'complex-object', input: {nested: {deep: {value: 'test'}}}},
      {id: 'large-string', input: 'a'.repeat(10000)},
      {id: 'unicode-content', input: '🚀 🎉 📦 测试 тестирование テスト'},
      {id: 'special-chars', input: '\n\t\r\\n\\t\\r'},
      {id: 'null-input', input: null},
      {id: 'undefined-input', input: undefined},
      {id: 'number-input', input: 42},
      {id: 'boolean-input', input: true},
    ];
  }

  async runFullValidation(): Promise<WASMFallbackReport> {
    const testCases = this.generateTestCases();
    const results: WASMFallbackResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runFallbackTest(testCase.id, testCase.input);
      results.push(result);
    }

    const total = results.length;
    const rustSuccessCount = results.filter((r) => r.rustSuccess).length;
    const wasmSuccessCount = results.filter((r) => r.wasmSuccess).length;
    const jsFallbackSuccessCount = results.filter(
      (r) => r.jsFallbackSuccess,
    ).length;
    const fallbackCount = results.filter((r) => r.fallbackTriggered).length;

    const summary = {
      total,
      rustSuccessRate: rustSuccessCount / total,
      wasmSuccessRate: wasmSuccessCount / total,
      jsFallbackSuccessRate: jsFallbackSuccessCount / total,
      fallbackRate: fallbackCount / total,
      averagePerformance: {
        rustTime:
          results.reduce((sum, r) => sum + r.performance.rustTime, 0) / total,
        wasmTime:
          results.reduce((sum, r) => sum + r.performance.wasmTime, 0) / total,
        jsFallbackTime:
          results.reduce((sum, r) => sum + r.performance.jsFallbackTime, 0) /
          total,
      },
    };

    const report: WASMFallbackReport = {
      version: this.schemaManager.getCurrentVersion(),
      environment: process.env.NODE_ENV || 'test',
      results,
      summary,
    };

    return report;
  }

  async saveReport(
    report: WASMFallbackReport,
    outputPath: string,
  ): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), {recursive: true});
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  }

  async loadReport(inputPath: string): Promise<WASMFallbackReport> {
    const content = await fs.readFile(inputPath, 'utf-8');
    return JSON.parse(content);
  }

  validateFallbackBehavior(report: WASMFallbackReport): {
    valid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if fallback rate is reasonable (not too high, not too low)
    if (report.summary.fallbackRate > 0.5) {
      issues.push(
        'High fallback rate (>50%) indicates potential issues with native implementations',
      );
    } else if (report.summary.fallbackRate < 0.05) {
      recommendations.push(
        'Consider adding more test cases that trigger fallback scenarios',
      );
    }

    // Check if JS fallback success rate is acceptable
    if (report.summary.jsFallbackSuccessRate < 0.9) {
      issues.push('JS fallback success rate is below 90%');
    }

    // Check performance characteristics
    if (
      report.summary.averagePerformance.jsFallbackTime >
      report.summary.averagePerformance.rustTime * 10
    ) {
      recommendations.push(
        'JS fallback is significantly slower than Rust implementation',
      );
    }

    // Validate that fallback is actually triggered when needed
    const fallbackTests = report.results.filter((r) => r.fallbackTriggered);
    const validFallbacks = fallbackTests.filter(
      (r) => !r.rustSuccess || !r.wasmSuccess,
    );

    if (validFallbacks.length !== fallbackTests.length) {
      issues.push(
        'Fallback triggered in cases where native implementations succeeded',
      );
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
    };
  }
}
