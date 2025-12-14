import assert from 'assert';
import {normalizePaths, stripTimestamps, stableSortKeys} from './normalize';
import path from 'path';

describe('baseline utils', () => {
  describe('normalizePaths', () => {
    it('should replace CWD with <ROOT> in strings', () => {
      const cwd = process.cwd();
      const input = `File is at ${cwd}/src/index.js`;
      const expected = 'File is at <ROOT>/src/index.js';
      assert.strictEqual(normalizePaths(input), expected);
    });

    it('should normalize paths in objects and arrays', () => {
      const cwd = process.cwd();
      const input = {
        files: [`${cwd}/a.js`, `${cwd}/b.js`],
        meta: {
          path: `${cwd}/config.json`,
        },
      };
      const expected = {
        files: ['<ROOT>/a.js', '<ROOT>/b.js'],
        meta: {
          path: '<ROOT>/config.json',
        },
      };
      assert.deepStrictEqual(normalizePaths(input), expected);
    });
  });

  describe('stripTimestamps', () => {
    it('should zero out time and buildTime keys', () => {
      const input = {
        name: 'test',
        time: 123456,
        buildTime: 7890,
        nested: {
          time: 555,
          other: 'val',
        },
      };
      const expected = {
        name: 'test',
        time: 0,
        buildTime: 0,
        nested: {
          time: 0,
          other: 'val',
        },
      };
      assert.deepStrictEqual(stripTimestamps(input), expected);
    });
  });

  describe('stableSortKeys', () => {
    it('should sort object keys alphabetically', () => {
      const input = {
        z: 1,
        a: 2,
        m: {
          y: 3,
          b: 4,
        },
      };
      // JSON.stringify order depends on key insertion order in some environments,
      // but stableSortKeys ensures specific reconstruction order.
      // We verify by checking key order of the result.
      const output = stableSortKeys(input);
      assert.deepStrictEqual(Object.keys(output), ['a', 'm', 'z']);
      assert.deepStrictEqual(Object.keys(output.m), ['b', 'y']);
    });
  });
});
