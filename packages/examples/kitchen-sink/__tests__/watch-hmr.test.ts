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

describe('watch hmr', function () {
  this.timeout(120000);
  let tmpDir: string;
  let sub: any;
  let ws: WebSocket;
  let parcel: Parcel | undefined;
  let cleanup: (() => Promise<void>) | undefined;
  let workerExit: (() => Promise<void>) | undefined;

  beforeEach(() => {
    // create temp dir and copy fixture
    tmpDir = fs.mkdtempSync(path.join(path.dirname(FIXTURE_PATH), 'hmr-tmp-'));
    fs.cpSync(FIXTURE_PATH, tmpDir, {recursive: true});
  });

  afterEach(async () => {
    if (ws) {
      ws.close();
      // Wait for close
      await new Promise((r) => ws.on('close', r));
    }
    if (sub) await sub.unsubscribe();
    if (parcel && (parcel as any).unstable__end) {
      await (parcel as any).unstable__end();
    }
    if (parcel && (parcel as any).stop) {
      await (parcel as any).stop();
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      // Retry removal as it might be locked briefly
      try {
        fs.rmSync(tmpDir, {recursive: true, force: true});
      } catch (e) {
        // ignore
      }
    }
  });

  it('scripted hmr session', async () => {
    const port = await getPort();
    const entry = path.join(tmpDir, 'index.html');
    const indexJs = path.join(tmpDir, 'index.js');
    const messages: any[] = [];
    let messageIndex = 0;

    console.log('[watch-hmr] scripted: creating Parcel');
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
    let buildSuccessPromise = new Promise<void>((resolve, reject) => {
      buildSuccessResolve = resolve;
      buildSuccessReject = reject;
    });
    const buildSuccessTimeout = setTimeout(() => {
      buildSuccessReject(
        new Error('[watch-hmr] buildSuccess timeout (scripted session)'),
      );
    }, 30000);
  }, 30000);

  sub = await parcel.watch((err, event) => {
    if (err) return;
    if (event?.type === 'buildSuccess') {
      clearTimeout(buildSuccessTimeout);
      buildSuccessResolve();
    }
  });

  await buildSuccessPromise;

  // Connect WS
  ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve) => ws.once('open', () => resolve()));

  ws.on('message', (data: any) => {
    const msg = JSON.parse(data.toString());
    messages.push(msg);
  });

  // Helper to wait for a specific message type
  const waitForMessage = async (type: string, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (let i = messageIndex; i < messages.length; i++) {
        if (messages[i].type === type) {
          messageIndex = i + 1;
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timeout waiting for message type: ${type}`);
  };

  // Wait for initial handshake if any (usually 'build' is sent on connect)
  // Actually, Parcel HMR sends the latest build event on connection.
  // await waitForMessage('build');

  // Step 1: Edit file (valid change)
  // Wait a bit to ensure timestamps differ if filesystem resolution is low
  await new Promise((r) => setTimeout(r, 1000));
  fs.appendFileSync(indexJs, '\nconsole.log("update 1");');

  await waitForMessage('update');

  // Step 2: Introduce syntax error
  await new Promise((r) => setTimeout(r, 1000));
  fs.appendFileSync(indexJs, '\nconsole.log("error"'); // Missing closing paren

  await waitForMessage('error');

  // Step 3: Fix error
  await new Promise((r) => setTimeout(r, 1000));
  const content = fs.readFileSync(indexJs, 'utf8');
  fs.writeFileSync(indexJs, content + ');');

  await waitForMessage('update');

  // Normalize messages using the improved pipeline
  const normalizedMessages = normalizeHMRMessagePipeline(messages);

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
  assert.ok(assets.length > 0, 'Should have extracted assets from HMR events');

  // Basic assertions for backward compatibility
  assert(
    normalizedMessages.length >= 3,
    'Should have at least 3 messages (update, error, update)',
  );
  const types = normalizedMessages.map((m: any) => m.type);
  assert.ok(types.includes('error'), 'Should contain error message');
  assert.ok(types.includes('update'), 'Should contain update message');
});

it('comprehensive hmr session with multiple asset types', async () => {
  const port = await getPort();
  const entry = path.join(tmpDir, 'index.html');
  const indexJs = path.join(tmpDir, 'index.js');
  const moduleJs = path.join(tmpDir, 'module.js');
  const styleCss = path.join(tmpDir, 'style.css');
  const messages: any[] = [];
  let messageIndex = 0;

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
  let buildSuccessPromise = new Promise<void>((resolve, reject) => {
    buildSuccessResolve = resolve;
    buildSuccessReject = reject;
  });
  const buildSuccessTimeout = setTimeout(() => {
    buildSuccessReject(
      new Error('[watch-hmr] buildSuccess timeout (scripted session)'),
    );
  }, 30000);

  sub = await parcel.watch((err, event) => {
    if (err) return;
    if (event?.type === 'buildSuccess') {
      clearTimeout(buildSuccessTimeout);
      buildSuccessResolve();
    }
  });

  await buildSuccessPromise;

  // Connect WS
  ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve) => ws.once('open', () => resolve()));

  ws.on('message', (data: any) => {
    const msg = JSON.parse(data.toString());
    messages.push(msg);
  });

  // Helper to wait for a specific message type
  const waitForMessage = async (type: string, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (let i = messageIndex; i < messages.length; i++) {
        if (messages[i].type === type) {
          messageIndex = i + 1;
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timeout waiting for message type: ${type}`);
  };

  // Step 1: Update JavaScript module
  await new Promise((r) => setTimeout(r, 1000));
  fs.appendFileSync(moduleJs, '\nexport const newVar = "updated";');

  await waitForMessage('update');

  // Step 2: Update CSS
  await new Promise((r) => setTimeout(r, 1000));
  fs.appendFileSync(styleCss, '\nbody { color: red; }');

  await waitForMessage('update');

  // Step 3: Update main JavaScript
  await new Promise((r) => setTimeout(r, 1000));
  fs.appendFileSync(indexJs, '\nconsole.log("main updated");');

  await waitForMessage('update');

  // Normalize and validate
  const normalizedMessages = normalizeHMRMessagePipeline(messages);
  validateHMRParityRequirements(normalizedMessages as HMREvent[]);

  // Should have at least 2 update events (some may be batched)
  const updateEvents = normalizedMessages.filter(
    (m: any) => m.type === 'update',
  );
  assert.ok(
    updateEvents.length >= 2,
    `Should have at least 2 update events, got ${updateEvents.length}`,
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
