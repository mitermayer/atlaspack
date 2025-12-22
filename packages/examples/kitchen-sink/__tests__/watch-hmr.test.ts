import assert from 'assert';
import path from 'path';
import fs from 'fs';
import {Parcel} from '@atlaspack/core';
import {writeEvents} from '../../../core/core/test/utils/artifacts';
import {normalizeHMRMessagePipeline} from './hmr-normalization';
import {
  validateHMRParityRequirements,
  validateHMRSequence,
  extractHMRAssets,
  HMREvent,
} from './hmr-validation';
import getPort from 'get-port';
import WebSocket from 'ws';

const FIXTURE_PATH = path.join(__dirname, '../__fixtures__/hmr');
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  '.parcel-cache/parity/js/hmr/events.json',
);

const DEBUG = process.env.ATLASPACK_MOCHA_HANG_DEBUG === 'true';

function debugLog(...args: any[]): void {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[watch-hmr]', ...args);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('watch hmr', function () {
  this.timeout(120000);
  let tmpDir: string;
  let sub: any;
  let ws: WebSocket | undefined;
  let parcel: Parcel | undefined;

  beforeEach(() => {
    // create temp dir and copy fixture
    tmpDir = fs.mkdtempSync(path.join(path.dirname(FIXTURE_PATH), 'hmr-tmp-'));
    fs.cpSync(FIXTURE_PATH, tmpDir, {recursive: true});
  });

  afterEach(async () => {
    debugLog('afterEach: starting cleanup');

    if (ws) {
      try {
        ws.close();
        await new Promise<void>((resolve) => {
          ws!.once('close', () => resolve());
        });
      } catch (e) {
        debugLog('afterEach: ws close error', e);
      } finally {
        ws = undefined;
      }
    }

    if (sub) {
      try {
        await sub.unsubscribe();
      } catch (e) {
        debugLog('afterEach: subscription unsubscribe error', e);
      } finally {
        sub = undefined;
      }
    }

    if (parcel && (parcel as any).unstable__end) {
      try {
        await (parcel as any).unstable__end();
      } catch (e) {
        debugLog('afterEach: unstable__end error', e);
      }
    }

    if (parcel && (parcel as any).stop) {
      try {
        await (parcel as any).stop();
      } catch (e) {
        debugLog('afterEach: stop error', e);
      }
    }

    parcel = undefined;

    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, {recursive: true, force: true});
      } catch (e) {
        // ignore
      }
    }

    debugLog('afterEach: cleanup complete');
  });

  async function startParcelWatch(options: {
    entry: string;
    port: number;
    label: string;
  }): Promise<{
    messages: any[];
    waitForMessage: (type: string, timeout?: number) => Promise<void>;
  }> {
    const {entry, port, label} = options;
    const messages: any[] = [];
    let messageIndex = 0;

    debugLog(label, 'creating Parcel');
    parcel = new Parcel({
      entries: entry,
      mode: 'development',
      hmrOptions: {port},
      serveOptions: false,
      defaultConfig: '@atlaspack/config-default',
      shouldDisableCache: true,
      workerFarm: {useLocalWorker: true, maxConcurrentWorkers: 1},
      projectRoot: PROJECT_ROOT,
      env: {
        ATLASPACK_ENGINE: process.env.ATLASPACK_ENGINE || 'js',
      },
    });

    let buildSuccessResolve: () => void;
    let buildSuccessReject: (err: Error) => void;
    const buildSuccessPromise = new Promise<void>((resolve, reject) => {
      buildSuccessResolve = resolve;
      buildSuccessReject = reject;
    });

    const buildSuccessTimeout = setTimeout(() => {
      const err = new Error(
        `${label} buildSuccess timeout while waiting for initial build`,
      );
      debugLog(label, 'buildSuccess timeout');
      buildSuccessReject(err);
    }, 30000);

    debugLog(label, 'calling parcel.watch');
    sub = await parcel.watch((err, event) => {
      if (err) {
        debugLog(label, 'watch callback error', err);
        return;
      }
      if (event) {
        debugLog(label, 'watch event', event.type);
      }
      if (event?.type === 'buildSuccess') {
        clearTimeout(buildSuccessTimeout);
        buildSuccessResolve();
      }
    });

    debugLog(label, 'waiting for initial buildSuccess');
    await buildSuccessPromise;
    debugLog(label, 'initial buildSuccess received');

    debugLog(label, 'connecting websocket');
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve) =>
      ws!.once('open', () => {
        debugLog(label, 'websocket open');
        resolve();
      }),
    );

    ws.on('message', (data: any) => {
      const msg = JSON.parse(data.toString());
      debugLog(label, 'ws message', msg.type);
      messages.push(msg);
    });

    const waitForMessage = async (type: string, timeout = 30000) => {
      debugLog(label, 'waitForMessage start', type);
      const start = Date.now();
      while (Date.now() - start < timeout) {
        for (let i = messageIndex; i < messages.length; i++) {
          if (messages[i].type === type) {
            messageIndex = i + 1;
            debugLog(label, 'waitForMessage resolved', type);
            return;
          }
        }
        await wait(100);
      }
      const err = new Error(`Timeout waiting for message type: ${type}`);
      debugLog(label, 'waitForMessage timeout', type);
      throw err;
    };

    return {messages, waitForMessage};
  }

  it('scripted hmr session', async () => {
    const port = await getPort();
    const entry = path.join(tmpDir, 'index.html');
    const indexJs = path.join(tmpDir, 'index.js');

    const {messages, waitForMessage} = await startParcelWatch({
      entry,
      port,
      label: '[watch-hmr] scripted',
    });

    // Step 1: Edit file (valid change)
    await wait(1000);
    fs.appendFileSync(indexJs, '\nconsole.log("update 1");');
    await waitForMessage('update');

    // Step 2: Introduce syntax error
    await wait(1000);
    fs.appendFileSync(indexJs, '\nconsole.log("error"'); // Missing closing paren
    await waitForMessage('error');

    // Step 3: Fix error
    await wait(1000);
    const content = fs.readFileSync(indexJs, 'utf8');
    fs.writeFileSync(indexJs, content + ');');
    await waitForMessage('update');

    // Normalize messages using the improved pipeline
    const normalizedMessages = normalizeHMRMessagePipeline(messages);
    debugLog(
      '[watch-hmr] scripted normalized types',
      ...(normalizedMessages as any[]).map((m) => m.type),
    );

    // Write events
    writeEvents(normalizedMessages, OUTPUT_PATH);

    // Enhanced validation using the new utilities
    validateHMRParityRequirements(normalizedMessages as HMREvent[]);

    // Validate the expected sequence: update -> error -> update
    validateHMRSequence(normalizedMessages as HMREvent[], [
      'update',
      'error',
      'update',
    ]);

    // Extract and validate assets
    const assets = extractHMRAssets(normalizedMessages as HMREvent[]);
    assert.ok(
      assets.length > 0,
      'Should have extracted assets from HMR events',
    );

    // Basic assertions for backward compatibility
    assert(
      normalizedMessages.length >= 3,
      'Should have at least 3 messages (update, error, update)',
    );
    const types = (normalizedMessages as any[]).map((m) => m.type);
    assert.ok(types.includes('error'), 'Should contain error message');
    assert.ok(types.includes('update'), 'Should contain update message');
  });

  it('comprehensive hmr session with multiple asset types', async () => {
    const port = await getPort();
    const entry = path.join(tmpDir, 'index.html');
    const indexJs = path.join(tmpDir, 'index.js');
    const moduleJs = path.join(tmpDir, 'module.js');
    const styleCss = path.join(tmpDir, 'style.css');

    const {messages, waitForMessage} = await startParcelWatch({
      entry,
      port,
      label: '[watch-hmr] comprehensive',
    });

    // Step 1: Update JavaScript module
    await wait(1000);
    fs.appendFileSync(moduleJs, '\nexport const newVar = "updated";');

    // Step 2: Update CSS
    await wait(1000);
    fs.appendFileSync(styleCss, '\nbody { color: red; }');

    // Step 3: Update main JavaScript
    await wait(1000);
    fs.appendFileSync(indexJs, '\nconsole.log("main updated");');

    // Wait for at least one HMR update covering the edits
    await waitForMessage('update');

    // Normalize and validate
    const normalizedMessages = normalizeHMRMessagePipeline(messages);
    debugLog(
      '[watch-hmr] comprehensive normalized types',
      ...(normalizedMessages as any[]).map((m) => m.type),
    );
    validateHMRParityRequirements(normalizedMessages as HMREvent[]);

    // Should have at least 1 update event (some may be batched)
    const updateEvents = (normalizedMessages as any[]).filter(
      (m) => m.type === 'update',
    );
    assert.ok(
      updateEvents.length >= 1,
      `Should have at least 1 update event, got ${updateEvents.length}`,
    );

    // Extract assets and validate we have different types
    const assets = extractHMRAssets(normalizedMessages as HMREvent[]);
    const assetTypes = new Set(assets.map((a) => a.type));
    assert.ok(assetTypes.has('js'), 'Should have JavaScript assets');

    // Write comprehensive events
    const comprehensiveOutputPath = path.join(
      PROJECT_ROOT,
      '.parcel-cache/parity/js/hmr/comprehensive-events.json',
    );
    writeEvents(normalizedMessages, comprehensiveOutputPath);
  });
});
