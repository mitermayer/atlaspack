import path from 'path';
import {mkdirSync, writeFileSync} from 'fs';
import {normalizePaths, stripTimestamps, stableSortKeys} from './normalize';

/**
 * Ensures the directory exists and writes data as JSON.
 */
function writeJson(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), {recursive: true});
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Normalizes and writes the build summary artifact.
 *
 * Pipeline: stripTimestamps -> normalizePaths -> stableSortKeys
 */
export function writeSummary(data: unknown, outPath: string): void {
  const normalized = stableSortKeys(normalizePaths(stripTimestamps(data)));
  writeJson(outPath, normalized);
}

/**
 * Normalizes and writes the build events artifact.
 *
 * Pipeline: stripTimestamps -> normalizePaths -> stableSortKeys
 */
export function writeEvents(events: unknown[], outPath: string): void {
  const normalized = stableSortKeys(normalizePaths(stripTimestamps(events)));
  writeJson(outPath, normalized);
}
