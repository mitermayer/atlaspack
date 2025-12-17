import {
  atlaspackNapiCreate,
  atlaspackNapiBuildAssetGraph,
  atlaspackNapiRespondToFsEvents,
  AtlaspackNapi,
  Lmdb,
  AtlaspackNapiOptions,
} from '@atlaspack/rust';
import {EventEmitter} from 'events';
import path from 'path';
import {NapiWorkerPool} from './NapiWorkerPool';
import ThrowableDiagnostic from '@atlaspack/diagnostic';
import type {Event} from '@parcel/watcher';
import type {NapiWorkerPool as INapiWorkerPool} from '@atlaspack/types';

export type AtlaspackV3Options = {
  fs?: AtlaspackNapiOptions['fs'];
  packageManager?: AtlaspackNapiOptions['packageManager'];
  threads?: number;
  /**
   * A reference to LMDB lite's rust object
   */
  lmdb: Lmdb;
  featureFlags?: {
    [key: string]: string | boolean;
  };
  napiWorkerPool?: INapiWorkerPool;
} & AtlaspackNapiOptions['options'];

export class AtlaspackV3 extends EventEmitter {
  _atlaspack_napi: AtlaspackNapi;
  _napiWorkerPool: INapiWorkerPool;
  _isDefaultNapiWorkerPool: boolean;

  constructor(
    atlaspack_napi: AtlaspackNapi,
    napiWorkerPool: INapiWorkerPool,
    isDefaultNapiWorkerPool: boolean,
  ) {
    super();
    this._atlaspack_napi = atlaspack_napi;
    this._napiWorkerPool = napiWorkerPool;
    this._isDefaultNapiWorkerPool = isDefaultNapiWorkerPool;

    // @ts-expect-error accessing event emitter method
    this._napiWorkerPool.on('report', (event) => this.emit('report', event));
  }

  static async create({
    fs,
    packageManager,
    threads,
    lmdb,
    napiWorkerPool,
    ...options
  }: AtlaspackV3Options): Promise<AtlaspackV3> {
    // @ts-expect-error TS2339
    options.logLevel = options.logLevel || 'error';
    // @ts-expect-error TS2339
    options.defaultTargetOptions = options.defaultTargetOptions || {};
    // @ts-expect-error TS2339
    options.defaultTargetOptions.engines =
      // @ts-expect-error TS2339
      options.defaultTargetOptions.engines || {};

    let isDefaultNapiWorkerPool = false;
    if (!napiWorkerPool) {
      napiWorkerPool = new NapiWorkerPool();
      isDefaultNapiWorkerPool = true;
    }

    // Ensure env values are strings and not null
    // @ts-expect-error TS2339
    if (options.env) {
      // @ts-expect-error TS2339
      for (const key in options.env) {
        // @ts-expect-error TS2339
        const val = options.env[key];
        if (val == null) {
          // @ts-expect-error TS2339
          delete options.env[key];
        } else if (typeof val !== 'string') {
          // @ts-expect-error TS2339
          options.env[key] = String(val);
        }
      }
    }

    const modifiedOptions = {...options};

    // Previously we attempted to shorten absolute entry paths before
    // passing them through NAPI. This interfered with the Rust engine's
    // entry resolution which expects either absolute paths or paths
    // relative to the current working directory. Keep entries as-is here
    // and rely on the Rust engine to infer the project root correctly.

    // eslint-disable-next-line no-console
    console.log(
      '[AtlaspackV3.create] options.entries',
      (modifiedOptions as any).entries,
      'projectRoot',
      (modifiedOptions as any).projectRoot,
    );

    // Build a minimal, JSON-serializable options object that matches the
    // Rust `AtlaspackOptions` shape. This avoids passing complex JS-only
    // fields (like FileSystem instances or caches) through N-API, which
    // cannot be deserialized by serde.
    const atlaspackOptions: any = {
      corePath: (modifiedOptions as any).corePath ?? path.join(__dirname, '..'),
      serveOptions: (modifiedOptions as any).serveOptions ?? false,
      entries: (modifiedOptions as any).entries ?? [],
      env: (modifiedOptions as any).env,
      defaultConfig: (modifiedOptions as any).defaultConfig,
      config: (modifiedOptions as any).config,
      logLevel: (modifiedOptions as any).logLevel,
      mode: (modifiedOptions as any).mode,
      threads,
      targets: (modifiedOptions as any).targets,
      shouldDisableCache: (modifiedOptions as any).shouldDisableCache,
      featureFlags: (modifiedOptions as any).featureFlags,
      hmrOptions: (modifiedOptions as any).hmrOptions,
      defaultTargetOptions: (modifiedOptions as any).defaultTargetOptions,
    };

    // @ts-expect-error TS2488
    const [internal, error] = await atlaspackNapiCreate(
      {
        fs,
        packageManager,
        threads,
        options: atlaspackOptions,
        napiWorkerPool,
      },
      lmdb,
    );

    if (error !== null) {
      if (isDefaultNapiWorkerPool) {
        napiWorkerPool.shutdown();
      }
      throw new ThrowableDiagnostic({
        diagnostic: error,
      });
    }

    return new AtlaspackV3(internal, napiWorkerPool, isDefaultNapiWorkerPool);
  }

  end(): void {
    // If the worker pool was provided to us, don't shut it down, it's up to the provider.
    if (this._isDefaultNapiWorkerPool) {
      this._napiWorkerPool.shutdown();
    }
  }

  buildAssetGraph(): Promise<any> {
    return atlaspackNapiBuildAssetGraph(this._atlaspack_napi) as Promise<any>;
  }

  async respondToFsEvents(events: Array<Event>): Promise<boolean> {
    // @ts-expect-error TS2488
    let [needsRebuild, error] = await atlaspackNapiRespondToFsEvents(
      this._atlaspack_napi,
      events,
    );

    if (error) {
      throw new Error(error);
    }

    return needsRebuild;
  }
}
