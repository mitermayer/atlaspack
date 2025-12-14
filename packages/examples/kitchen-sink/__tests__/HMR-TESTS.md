# HMR Watch Tests

This directory contains Hot Module Replacement (HMR) watch mode tests for Atlaspack parity testing between JavaScript and Rust engines.

## Test Structure

### Files

- `watch-hmr.test.ts` - Main HMR test implementation
- `hmr-normalization.ts` - HMR-specific event normalization utilities
- `hmr-validation.ts` - HMR event validation utilities
- `__fixtures__/hmr/` - Test fixture directory

### Fixture Structure

```
__fixtures__/hmr/
├── index.html      # Main HTML entry point
├── index.js        # Main JavaScript with HMR API usage
├── module.js       # ES module for import testing
├── style.css       # CSS for HMR testing
└── events.json     # Expected HMR events fixture
```

## Test Coverage

### Basic HMR Test (`scripted hmr session`)

Tests the fundamental HMR workflow:

1. Initial build and WebSocket connection
2. Valid file change → update event
3. Syntax error introduction → error event
4. Error fix → update event

### Comprehensive HMR Test (`comprehensive hmr session`)

Tests multi-asset HMR scenarios:

1. ES module updates
2. CSS updates
3. Main JavaScript updates
4. Cross-asset dependency handling

## Normalization Pipeline

HMR events are normalized using a specialized pipeline:

```typescript
normalizeHMRMessagePipeline(events);
```

Pipeline stages:

1. **HMR-specific normalization** - Ports, temp dirs, bundle IDs, URLs
2. **Timestamp stripping** - Remove timing variations
3. **Path normalization** - Standardize file paths
4. **Key sorting** - Ensure deterministic JSON output

### Normalized Values

- `localhost:PORT` - All port references
- `hmr-tmp` - Temporary directory names
- `HASH` - Bundle ID hashes
- `<ROOT>` - Project root paths

## Validation Utilities

### Event Structure Validation

- `validateHMRParityRequirements()` - Basic parity test requirements
- `validateHMRSequence()` - Expected event sequence
- `validateHMRUpdateEvent()` - Update event structure
- `validateHMRErrorEvent()` - Error event structure

### Asset Extraction

- `extractHMRAssets()` - Extract asset information for comparison

## Running Tests

```bash
# Run HMR tests only
yarn workspace @atlaspack/examples test --grep "watch hmr"

# Run with specific engine
ATLASPACK_ENGINE=js yarn workspace @atlaspack/examples test --grep "watch hmr"
ATLASPACK_ENGINE=rust yarn workspace @atlaspack/examples test --grep "watch hmr"

# Run dual mode (both engines)
ATLASPACK_ENGINE=dual yarn workspace @atlaspack/examples test --grep "watch hmr"
```

## Artifacts

Test artifacts are generated in:

```
.parcel-cache/parity/{engine}/hmr/
├── events.json              # Basic HMR events
└── comprehensive-events.json # Multi-asset HMR events
```

## CI Considerations

### Determinism

- All timestamps are stripped
- Random values are normalized
- File paths use consistent placeholders
- Object keys are sorted for stable JSON

### Performance

- Tests use `shouldDisableCache: true` for consistency
- Timeouts are generous for CI environments
- WebSocket connections are properly cleaned up

### Reliability

- Retry logic for file system operations
- Proper cleanup in afterEach hooks
- Error handling for network operations

## Expected Event Types

### Update Events

```typescript
{
  type: 'update',
  assets: [{
    id: string,
    type: 'js' | 'css' | 'html',
    path: string,
    generated: Record<string, string>,
    deps: Array<any>
  }],
  timestamp: number
}
```

### Error Events

```typescript
{
  type: 'error',
  errors: [{
    name: string,
    message: string,
    loc: {line: number, column: number},
    filePath: string,
    codeFrame: string
  }],
  timestamp: number
}
```

## Debugging

### Enable Verbose Logging

```bash
ATLASPACK_MOCHA_HANG_DEBUG=true yarn workspace @atlaspack/examples test --grep "watch hmr"
```

### Manual Inspection

Artifacts can be manually inspected to understand HMR event flow:

```bash
cat .parcel-cache/parity/js/hmr/events.json | jq .
```

### Common Issues

1. **Port conflicts** - Tests use dynamic port allocation
2. **File system timing** - Built-in delays ensure timestamp differences
3. **WebSocket cleanup** - Proper connection teardown prevents hangs
4. **Cache interference** - Cache disabled for test isolation
