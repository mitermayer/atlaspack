import {
  normalizePaths,
  stripTimestamps,
  stableSortKeys,
} from '../../../core/core/test/utils/normalize';

// Helper to escape regex special characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes HMR-specific values in events
 */
export function normalizeHMREvents(events: unknown[]): unknown[] {
  function normalizeEvent(event: unknown): unknown {
    if (typeof event === 'string') {
      // Normalize port references
      event = event.replace(/localhost:\d+/g, 'localhost:PORT');
      event = event.replace(/127\.0\.0\.1:\d+/g, 'localhost:PORT');
      // Normalize temp directory names
      event = event.replace(/hmr-tmp-[a-zA-Z0-9-]+/g, 'hmr-tmp');
      // Normalize WebSocket URLs
      event = event.replace(/ws:\/\/127\.0\.0\.1:\d+/g, 'ws://localhost:PORT');
      event = event.replace(
        /wss:\/\/127\.0\.0\.1:\d+/g,
        'wss://localhost:PORT',
      );
      return event;
    }

    if (Array.isArray(event)) {
      return event.map(normalizeEvent);
    }

    if (event !== null && typeof event === 'object') {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(event)) {
        const value = (event as Record<string, unknown>)[key];

        // Handle special HMR fields
        if (key === 'bundleId' && typeof value === 'string') {
          // Normalize bundle IDs that might contain hashes
          result[key] = value.replace(/[a-f0-9]{8,}/g, 'HASH');
        } else if (key === 'url' && typeof value === 'string') {
          // Normalize URLs in HMR events
          result[key] = value.replace(/localhost:\d+/g, 'localhost:PORT');
        } else if (key === 'filePath' && typeof value === 'string') {
          // Normalize file paths
          result[key] = value.replace(/hmr-tmp-[a-zA-Z0-9-]+/g, 'hmr-tmp');
        } else {
          result[key] = normalizeEvent(value);
        }
      }
      return result;
    }

    return event;
  }

  return events.map(normalizeEvent);
}

/**
 * Full normalization pipeline for HMR events
 * Pipeline: normalizeHMREvents -> stripTimestamps -> normalizePaths -> stableSortKeys
 */
export function normalizeHMRMessagePipeline(events: unknown[]): unknown[] {
  return stableSortKeys(
    normalizePaths(stripTimestamps(normalizeHMREvents(events))),
  );
}

/**
 * Validates HMR event structure
 */
export function validateHMREvents(events: unknown[]): boolean {
  if (!Array.isArray(events)) {
    return false;
  }

  for (const event of events) {
    if (typeof event !== 'object' || event === null) {
      return false;
    }

    const typedEvent = event as Record<string, unknown>;

    // All HMR events should have a type
    if (typeof typedEvent.type !== 'string') {
      return false;
    }

    // Validate specific event types
    switch (typedEvent.type) {
      case 'update':
        if (!Array.isArray(typedEvent.assets)) {
          return false;
        }
        break;
      case 'error':
        if (!Array.isArray(typedEvent.errors)) {
          return false;
        }
        break;
      case 'build':
        // Build events are valid
        break;
      default:
        // Unknown event types are allowed for extensibility
        break;
    }
  }

  return true;
}
