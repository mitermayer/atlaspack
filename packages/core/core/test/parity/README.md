# Parity Dual-Run Harness

This directory contains the T1 parity dual-run harness implementation for comparing JavaScript and Rust Atlaspack engines.

## Files

### Core Implementation

- `packages/core/core/test/utils/parity-runner.ts` - Enhanced parity runner with dual-run support
- `packages/core/core/test/utils/diff.ts` - Build comparison utilities
- `packages/core/core/test/utils/parity-reporter.ts` - Report generation and logging

### Tests and Fixtures

- `packages/core/core/test/parity/dual-run.test.ts` - Basic dual-run test suite
- `packages/core/core/test/__fixtures__/dual-run-basic/` - Simple test fixture

## Usage

### Running Tests

```bash
# Run only the dual-run tests
yarn test:js:unit packages/core/core/test/parity/dual-run.test.ts

# Run with grep pattern
yarn test:js:unit --grep "dual-run" packages/core/core/test/parity/dual-run.test.ts
```

### Environment Variables

- `ATLASPACK_ENGINE=js` - Run JavaScript engine only
- `ATLASPACK_ENGINE=rust` - Run Rust engine only
- `ATLASPACK_ENGINE=dual` - Run both engines and compare results (default when not set)

### API

```typescript
import {runParityBuild} from './utils/parity-runner';

const result = await runParityBuild(fixturePath, {
  entry: 'index.js',
  mode: 'production',
  compareOutputs: true,
});

// result.jsResult - JavaScript build results
// result.rustResult - Rust build results (if available)
// result.comparison - Comparison results (if both engines ran)
```

## Output

### Build Artifacts

- `.parcel-cache/parity/js/{fixture}/` - JavaScript build outputs
- `.parcel-cache/parity/rust/{fixture}/` - Rust build outputs
- `.parcel-cache/parity/reports/{fixture}.json` - Comparison reports

### Comparison Results

The harness compares:

- Bundle count and types
- Build performance
- File existence and sizes
- Content differences (limited to first 5 differences per file)

## Current Status

✅ **T1 Complete**: Basic dual-run harness with JS engine support

- Enhanced parity-runner.ts with dual-run mode
- Build comparison utilities
- Report generation
- Basic test suite with fixture
- Works with `yarn test:js:unit --grep "dual-run"`

🔄 **Next Steps**: Rust engine integration when available
