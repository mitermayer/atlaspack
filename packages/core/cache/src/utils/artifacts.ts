import path from 'path';
import {mkdirSync, writeFileSync} from 'fs';

function writeJson(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), {recursive: true});
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

export function writeSummary(data: unknown, outPath: string): void {
  writeJson(outPath, data);
}

export function writeEvents(events: unknown[], outPath: string): void {
  writeJson(outPath, events);
}
