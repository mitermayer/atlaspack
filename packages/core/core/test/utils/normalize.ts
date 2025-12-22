import path from 'path';

// Helper to escape regex special characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizePaths(value: unknown): unknown {
  const cwd = process.cwd();
  // Create a regex that matches the CWD.
  // We want to replace it globally.
  const cwdRegex = new RegExp(escapeRegExp(cwd), 'g');

  function visit(val: unknown): unknown {
    if (typeof val === 'string') {
      return val.replace(cwdRegex, '<ROOT>');
    }

    if (Array.isArray(val)) {
      return val.map(visit);
    }

    if (val !== null && typeof val === 'object') {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(val)) {
        result[key] = visit((val as Record<string, unknown>)[key]);
      }
      return result;
    }

    return val;
  }

  return visit(value);
}

const TIMESTAMP_KEYS = new Set(['time', 'buildTime', 'startTime', 'endTime']);

export function stripTimestamps(value: unknown): unknown {
  function visit(val: unknown): unknown {
    if (Array.isArray(val)) {
      return val.map(visit);
    }

    if (val !== null && typeof val === 'object') {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(val)) {
        if (TIMESTAMP_KEYS.has(key)) {
          result[key] = 0;
        } else {
          result[key] = visit((val as Record<string, unknown>)[key]);
        }
      }
      return result;
    }

    return val;
  }

  return visit(value);
}

export function stableSortKeys(value: unknown): unknown {
  function visit(val: unknown): unknown {
    if (Array.isArray(val)) {
      return val.map(visit);
    }

    if (val !== null && typeof val === 'object') {
      const keys = Object.keys(val).sort();
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        result[key] = visit((val as Record<string, unknown>)[key]);
      }
      return result;
    }

    return val;
  }

  return visit(value);
}
