import assert from 'assert';
import {getCacheKey} from '../src/RequestTracker';
import type {AtlaspackOptions} from '../src/types';

const DEFAULT_OPTIONS = {
  entries: [],
  mode: 'development',
  shouldBuildLazily: false,
  watchBackend: undefined,
} as unknown as AtlaspackOptions;

describe('getCacheKey', () => {
  it('should return a stable cache key for the same options', () => {
    const key1 = getCacheKey(DEFAULT_OPTIONS);
    const key2 = getCacheKey({...DEFAULT_OPTIONS});
    assert.strictEqual(key1, key2);
  });

  it('should change when mode changes', () => {
    const key1 = getCacheKey(DEFAULT_OPTIONS);
    const key2 = getCacheKey({...DEFAULT_OPTIONS, mode: 'production'});
    assert.notStrictEqual(key1, key2);
  });

  it('should change when entries change', () => {
    const key1 = getCacheKey(DEFAULT_OPTIONS);
    const key2 = getCacheKey({...DEFAULT_OPTIONS, entries: ['index.js']});
    assert.notStrictEqual(key1, key2);
  });

  it('should change when shouldBuildLazily changes', () => {
    const key1 = getCacheKey(DEFAULT_OPTIONS);
    const key2 = getCacheKey({
      ...DEFAULT_OPTIONS,
      shouldBuildLazily: !DEFAULT_OPTIONS.shouldBuildLazily,
    });
    assert.notStrictEqual(key1, key2);
  });

  it('should change when watchBackend changes', () => {
    const key1 = getCacheKey(DEFAULT_OPTIONS);
    const key2 = getCacheKey({
      ...DEFAULT_OPTIONS,
      watchBackend: 'windows',
    });
    assert.notStrictEqual(key1, key2);
  });
});
