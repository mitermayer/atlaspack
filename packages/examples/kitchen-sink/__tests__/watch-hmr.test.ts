import assert from 'assert';
import path from 'path';
import fs from 'fs';
import {Parcel} from '@atlaspack/core';
import {writeEvents} from '../../../core/core/test/utils/artifacts';
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

    const parcel = new Parcel({
      entries: entry,
      mode: 'development',
      hmrOptions: {port},
      serveOptions: false,
      defaultConfig: '@atlaspack/config-default',
      shouldDisableCache: true,
      env: {
        ATLASPACK_ENGINE: process.env.ATLASPACK_ENGINE || 'js',
      },
    });

    let buildSuccessResolve: () => void;
    let buildSuccessPromise = new Promise<void>(
      (r) => (buildSuccessResolve = r),
    );

    sub = await parcel.watch((err, event) => {
      if (err) return;
      if (event?.type === 'buildSuccess') {
        buildSuccessResolve();
      }
    });

    await buildSuccessPromise;

    // Connect WS
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve) => ws.once('open', () => resolve()));

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      messages.push(msg);
    });

    // Helper to wait for a specific message type
    const waitForMessage = async (type: string, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (
          messages.length > 0 &&
          messages[messages.length - 1].type === type
        ) {
          return;
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

    // Normalize messages
    function normalizeMessages(obj: any): any {
      if (typeof obj === 'string') {
        // Normalize port
        obj = obj.replace(/localhost:\d+/g, 'localhost:PORT');
        obj = obj.replace(/127.0.0.1:\d+/g, 'localhost:PORT');
        // Normalize temp dir
        obj = obj.replace(/hmr-tmp-[a-zA-Z0-9]+/g, 'hmr-tmp');
        // Normalize bundle IDs if they are unstable (they seem stable-ish but hash based)
        // For now keep them.
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(normalizeMessages);
      }
      if (obj && typeof obj === 'object') {
        const res: any = {};
        for (const key in obj) {
          res[key] = normalizeMessages(obj[key]);
        }
        return res;
      }
      return obj;
    }

    const normalizedMessages = normalizeMessages(messages);

    // Write events
    writeEvents(normalizedMessages, OUTPUT_PATH);

    // Assertions
    assert(
      messages.length >= 3,
      'Should have at least 3 messages (update, error, update)',
    );
    const types = messages.map((m) => m.type);
    assert.ok(types.includes('error'), 'Should contain error message');
    assert.ok(types.includes('update'), 'Should contain update message');
  });
});
