# Cache Compatibility & Testing System

This document describes the cache compatibility and testing system implemented for Atlaspack's Rust migration, specifically addressing T7: Compatibility & cache tests.

## Overview

The cache compatibility system ensures that:

1. Cache schema versions are properly managed and migrated
2. Hash parity is maintained between JavaScript, Rust, and WASM implementations
3. WASM fallback mechanisms work correctly
4. Cache data remains consistent across implementation changes

## Components

### 1. Cache Schema Manager (`CacheSchemaManager.ts`)

Manages cache schema versioning and migrations.

#### Features:

- Version registration and management
- Automatic migration between versions
- Compatibility checking
- Data preservation during migrations

#### Usage:

```typescript
import {CacheSchemaManager} from '@atlaspack/cache';

const schemaManager = new CacheSchemaManager();
await schemaManager.migrateCache(cache);
```

#### Schema Versions:

- **1.0.0**: Initial cache schema
- **1.1.0**: Added hash parity tracking
- **1.2.0**: Added WASM fallback metadata

### 2. Hash Parity Matrix Tester (`HashParityMatrixTester.ts`)

Tests hash consistency across different implementations.

#### Features:

- Comprehensive test case generation
- Cross-implementation hash comparison
- Regression detection
- Performance analysis

#### Test Cases Include:

- Basic strings and numbers
- JavaScript code samples
- Large content
- Unicode and special characters
- JSON, CSS, and HTML content

#### Usage:

```typescript
import {HashParityMatrixTester} from '@atlaspack/cache';

const tester = new HashParityMatrixTester('test-name');
await tester.setup();
const matrix = await tester.runFullMatrix();
await tester.cleanup();
```

### 3. WASM Fallback Validator (`WASMFallbackValidator.ts`)

Validates WASM fallback behavior and performance.

#### Features:

- Fallback scenario testing
- Performance benchmarking
- Error handling validation
- Behavior analysis

#### Test Scenarios:

- Normal operation (no fallback)
- Rust implementation failures
- WASM implementation failures
- WASM unavailability
- JS fallback failures

#### Usage:

```typescript
import {WASMFallbackValidator} from '@atlaspack/cache';

const validator = new WASMFallbackValidator('test-name');
await validator.setup();
const report = await validator.runFullValidation();
await validator.cleanup();
```

### 4. Enhanced Cache Tests (`cache-compatibility.test.ts`)

Comprehensive test suite covering all aspects of cache compatibility.

#### Test Categories:

- Schema versioning and migration
- Performance and reliability
- Build system integration
- Error handling and recovery

## CLI Tools

### Cache CLI (`cache-cli.ts`)

Command-line interface for cache operations.

#### Commands:

##### `validate`

Run full cache compatibility validation:

```bash
node cache-cli.js validate --output=./artifacts --threshold=0.95
```

Options:

- `--output=<dir>`: Save artifacts to specified directory
- `--compare=<file>`: Compare hash parity with previous results
- `--threshold=<rate>`: Minimum acceptable hash parity rate (0-1)
- `--verbose`: Enable verbose output

##### `migrate`

Migrate cache to latest schema version:

```bash
node cache-cli.js migrate ./.parcel-cache --version=1.2.0
```

Options:

- `--version=<version>`: Target version for migration

##### `diagnose`

Run cache diagnostics:

```bash
node cache-cli.js diagnose ./.parcel-cache
```

## Integration with Existing Infrastructure

### Epic 0 Normalization Utilities

The system uses existing normalization utilities from `@atlaspack/core/test/utils/normalize`:

- `normalizePaths()`: Normalizes file paths for cross-platform consistency
- `stripTimestamps()`: Removes timestamps for deterministic output
- `stableSortKeys()`: Ensures consistent object key ordering

### Artifact Generation

Uses existing artifact utilities:

- `writeEvents()`: Writes normalized event data
- `writeSummary()`: Writes normalized summary data

### Test Integration

Tests are designed to run with existing test patterns:

```bash
yarn test:js:unit --grep "cache|hash parity|wasm fallback"
```

## CI/CD Integration

### Deterministic Testing

All tests are designed to be deterministic and CI-ready:

- No reliance on real-time performance measurements for validation
- Consistent test data generation
- Cross-platform path normalization
- Timestamp stripping for reproducible results

### Artifact Storage

Test artifacts are stored in a structured format:

```json
{
  "version": "1.2.0",
  "environment": "test",
  "results": [...],
  "summary": {...}
}
```

### Regression Detection

The system automatically detects regressions:

- Hash parity regressions
- Performance regressions
- Fallback behavior changes

## Performance Considerations

### Cache Performance

- Concurrent operation support
- Large data handling
- Efficient serialization/deserialization
- Memory usage optimization

### Test Performance

- Parallel test execution where possible
- Efficient test case generation
- Minimal overhead for CI environments
- Configurable test data sizes

## Error Handling

### Graceful Degradation

- Fallback mechanisms for all critical operations
- Comprehensive error reporting
- Recovery procedures for corrupted data
- Backward compatibility maintenance

### Validation Errors

- Clear error messages for debugging
- Detailed failure analysis
- Recommendations for issue resolution
- Performance impact assessment

## Configuration

### Environment Variables

- `NODE_ENV`: Test environment configuration
- `ATLASPACK_BUILD_ENV`: Build environment setting
- `ATLASPACK_CACHE_DIR`: Custom cache directory

### Feature Flags

The system respects existing Atlaspack feature flags:

- `cachePerformanceImprovements`: Enables performance optimizations
- Custom flags for new functionality

## Best Practices

### Test Development

1. Use the provided test utilities for consistency
2. Follow the existing naming conventions
3. Ensure tests are deterministic
4. Include performance benchmarks where relevant
5. Test both success and failure scenarios

### Cache Usage

1. Always migrate cache schema before use
2. Handle errors gracefully
3. Use appropriate data structures for performance
4. Monitor cache size and cleanup
5. Validate data integrity regularly

### Migration

1. Test migrations thoroughly
2. Backup cache data before migration
3. Monitor migration performance
4. Validate data integrity post-migration
5. Rollback plan for failed migrations

## Troubleshooting

### Common Issues

1. **Migration Failures**: Check version compatibility and data integrity
2. **Hash Parity Issues**: Verify implementation consistency
3. **Performance Problems**: Monitor cache size and access patterns
4. **Fallback Failures**: Validate error handling paths

### Debugging Tools

1. Use the CLI diagnostics command
2. Enable verbose logging
3. Analyze test artifacts
4. Monitor performance metrics
5. Validate cache consistency

## Future Enhancements

### Planned Features

1. Real-time cache monitoring
2. Advanced performance analytics
3. Automated cache optimization
4. Enhanced migration tools
5. Integration with monitoring systems

### Extensibility

The system is designed for easy extension:

- Plugin architecture for custom validators
- Configurable test case generators
- Custom migration steps
- Additional performance metrics

## Conclusion

The cache compatibility and testing system provides a comprehensive solution for ensuring cache reliability and consistency across Atlaspack's Rust migration. It combines robust testing, validation, and migration tools with seamless integration into existing infrastructure.
