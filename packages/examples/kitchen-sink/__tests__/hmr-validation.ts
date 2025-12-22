import assert from 'assert';

/**
 * HMR Event validation utilities
 */

export interface HMRUpdateEvent {
  type: 'update';
  assets: Array<{
    id: string;
    type: string;
    path?: string;
    generated?: Record<string, string>;
    deps?: Array<any>;
  }>;
  timestamp?: number;
}

export interface HMRErrorEvent {
  type: 'error';
  diagnostics?: {
    ansi?: Array<{
      message: string;
      stack?: string;
      codeframe?: string;
      frames?: Array<{
        location: string;
        code: string;
      }>;
      hints?: string[];
      documentation?: string;
    }>;
    html?: Array<{
      message: string;
      stack?: string;
      frames?: Array<{
        location: string;
        code: string;
      }>;
      hints?: string[];
      documentation?: string;
    }>;
  };
  errors?: Array<{
    name?: string;
    message: string;
    loc?: {
      line: number;
      column: number;
    };
    filePath?: string;
    codeFrame?: string;
  }>;
  timestamp?: number;
}

export interface HMRBuildEvent {
  type: 'build';
  bundleGraph?: any;
  bundles?: Array<any>;
  timestamp?: number;
}

export type HMREvent =
  | HMRUpdateEvent
  | HMRErrorEvent
  | HMRBuildEvent
  | Record<string, unknown>;

/**
 * Validates that HMR events contain expected message types
 */
export function validateHMRMessageTypes(
  events: HMREvent[],
  expectedTypes: string[],
): void {
  const actualTypes = events.map((e) => e.type);

  for (const expectedType of expectedTypes) {
    assert.ok(
      actualTypes.includes(expectedType),
      `Expected HMR events to contain type '${expectedType}', but got: ${actualTypes.join(', ')}`,
    );
  }
}

/**
 * Validates that HMR events follow expected sequence
 */
export function validateHMRSequence(
  events: HMREvent[],
  expectedSequence: string[],
): void {
  const actualSequence = events.map((e) => e.type);

  assert.strictEqual(
    actualSequence.length,
    expectedSequence.length,
    `Expected ${expectedSequence.length} HMR events, but got ${actualSequence.length}`,
  );

  for (let i = 0; i < expectedSequence.length; i++) {
    assert.strictEqual(
      actualSequence[i],
      expectedSequence[i],
      `Expected HMR event ${i} to be type '${expectedSequence[i]}', but got '${actualSequence[i]}'`,
    );
  }
}

/**
 * Validates HMR update event structure
 */
export function validateHMRUpdateEvent(
  event: HMREvent,
): asserts event is HMRUpdateEvent {
  assert.strictEqual(event.type, 'update', 'Event should be of type "update"');
  assert.ok(
    Array.isArray(event.assets),
    'Update event should have assets array',
  );
  assert.ok(
    event.assets.length > 0,
    'Update event should have at least one asset',
  );

  for (const asset of event.assets) {
    assert.ok(typeof asset.id === 'string', 'Asset should have string id');
    assert.ok(typeof asset.type === 'string', 'Asset should have string type');
  }
}

/**
 * Validates HMR error event structure
 */
export function validateHMRErrorEvent(
  event: HMREvent,
): asserts event is HMRErrorEvent {
  assert.strictEqual(event.type, 'error', 'Event should be of type "error"');

  // Error events can have either 'errors' or 'diagnostics' field
  if (event.errors) {
    assert.ok(
      Array.isArray(event.errors),
      'Error event should have errors array',
    );
    assert.ok(
      event.errors.length > 0,
      'Error event should have at least one error',
    );

    for (const error of event.errors) {
      assert.ok(
        typeof error.message === 'string',
        'Error should have string message',
      );
    }
  } else if (event.diagnostics) {
    assert.ok(
      Array.isArray(event.diagnostics.ansi) ||
        Array.isArray(event.diagnostics.html),
      'Error event should have diagnostics with ansi or html arrays',
    );

    const diagnosticArray = event.diagnostics.ansi || event.diagnostics.html;
    if (diagnosticArray && diagnosticArray.length > 0) {
      for (const diagnostic of diagnosticArray) {
        assert.ok(
          typeof diagnostic.message === 'string',
          'Diagnostic should have string message',
        );
      }
    }
  } else {
    assert.fail('Error event should have either errors or diagnostics');
  }
}

/**
 * Validates that HMR events contain required content for parity testing
 */
export function validateHMRParityRequirements(events: HMREvent[]): void {
  assert.ok(
    events.length >= 1,
    'Should have at least 1 HMR event for parity testing',
  );

  // Should have at least one update event

  const updateEvents = events.filter((e) => e.type === 'update');
  assert.ok(updateEvents.length > 0, 'Should have at least one update event');

  // Validate update events have proper structure
  updateEvents.forEach(validateHMRUpdateEvent);

  // If there are error events, validate them too
  const errorEvents = events.filter((e) => e.type === 'error');
  errorEvents.forEach(validateHMRErrorEvent);
}

/**
 * Extracts asset information from HMR events for comparison
 */
export function extractHMRAssets(
  events: HMREvent[],
): Array<{id: string; type: string; content?: string}> {
  const assets: Array<{id: string; type: string; content?: string}> = [];

  for (const event of events) {
    if (event.type === 'update' && Array.isArray(event.assets)) {
      for (const asset of event.assets) {
        const assetInfo: {id: string; type: string; content?: string} = {
          id: asset.id,
          type: asset.type,
        };

        if (asset.generated && typeof asset.generated === 'object') {
          // Extract content from generated assets (e.g., generated.js)
          for (const [key, value] of Object.entries(asset.generated)) {
            if (
              typeof value === 'string' &&
              (key === 'js' || key === 'css' || key === 'html')
            ) {
              assetInfo.content = value;
              break;
            }
          }
        }

        assets.push(assetInfo);
      }
    }
  }

  return assets;
}
