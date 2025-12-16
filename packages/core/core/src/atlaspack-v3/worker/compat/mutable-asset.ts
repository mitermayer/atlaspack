import SourceMap from '@atlaspack/source-map';
import * as napi from '@atlaspack/rust';
import {Readable} from 'stream';
import type {
  MutableAsset as IMutableAsset,
  Stats,
  FileSystem,
  FilePath,
  Environment,
  Meta,
  BundleBehavior,
  ASTGenerator,
  AST,
  Dependency,
  DependencyOptions,
  FileCreateInvalidation,
  EnvironmentOptions,
} from '@atlaspack/types';
import {bundleBehaviorMap} from './bitflags';
import {MutableAssetSymbols, MutableDependencySymbols} from './asset-symbols';

// @ts-expect-error TS2694
export type InnerAsset = napi.Asset;

export class MutableAsset implements IMutableAsset {
  bundleBehavior: BundleBehavior | null | undefined;
  env: Environment;
  filePath: FilePath;
  fs: FileSystem;
  id: string;
  isBundleSplittable: boolean;
  // @ts-expect-error TS2564
  isMapDirty: boolean;
  isSource: boolean;
  meta: Meta;
  pipeline: string | null | undefined;
  query: URLSearchParams;
  sideEffects: boolean;
  stats: Stats;
  // @ts-expect-error TS2416
  symbols: MutableAssetSymbols;
  type: string;
  uniqueKey: string | null | undefined;

  #astDirty: boolean;
  #ast: AST | null | undefined;
  #contents: Buffer;
  #inner: InnerAsset;
  #map: string | null | undefined;
  #projectRoot: string;
  #sourceMap: SourceMap | null | undefined;
  #dependencies: Array<Dependency>;
  #stream: Readable | null | undefined;
  #code: string | null | undefined;

  get astGenerator(): ASTGenerator | null | undefined {
    throw new Error('get MutableAsset.astGenerator');
  }

  // @ts-expect-error TS1051
  set astGenerator(value?: ASTGenerator | null) {
    throw new Error('set MutableAsset.astGenerator');
  }

  constructor(
    asset: InnerAsset,
    contents: Buffer,
    env: Environment,
    fs: FileSystem,
    map: string | null | undefined,
    projectRoot: string,
  ) {
    this.bundleBehavior = bundleBehaviorMap.fromNullable(asset.bundleBehavior);
    this.env = env;
    this.filePath = asset.filePath;
    this.fs = fs;
    this.id = asset.id;
    this.isBundleSplittable = asset.isBundleSplittable;
    this.isSource = asset.isSource;
    this.meta = asset.meta;
    this.pipeline = asset.pipeline;
    this.query = new URLSearchParams(asset.query);
    this.sideEffects = asset.sideEffects;
    this.stats = asset.stats;
    this.symbols = new MutableAssetSymbols(asset.symbols);
    this.type = asset.type;
    this.uniqueKey = asset.uniqueKey;

    this.#astDirty = false;
    this.#contents = contents;
    this.#inner = asset;
    this.#map = map;
    this.#projectRoot = projectRoot;
    this.#dependencies = [];
  }

  // Getters for worker.ts to access the state
  get code(): string | null | undefined {
    return this.#code;
  }

  get dependencies(): Array<Dependency> {
    return this.#dependencies;
  }

  // eslint-disable-next-line require-await
  async getAST(): Promise<AST | null | undefined> {
    return this.#ast;
  }

  setAST(ast: AST): void {
    this.#astDirty = true;
    this.#ast = ast;
  }

  isASTDirty(): boolean {
    return this.#astDirty;
  }

  // eslint-disable-next-line require-await
  async getCode(): Promise<string> {
    if (this.#code != null) {
      return this.#code;
    }
    return this.#contents.toString();
  }

  setCode(code: string): void {
    this.#code = code;
    this.#contents = Buffer.from(code);
  }

  // eslint-disable-next-line require-await
  async getBuffer(): Promise<Buffer> {
    return this.#contents;
  }

  setBuffer(buf: Buffer): void {
    this.#contents = buf;
    this.#code = undefined;
  }

  getStream(): Readable {
    if (this.#stream) {
      return this.#stream;
    }
    return Readable.from(this.#contents);
  }

  setStream(stream: Readable): void {
    this.#stream = stream;
    const data: Array<Buffer> = [];

    stream.on('data', (chunk) => {
      data.push(chunk);
    });

    stream.on('end', () => {
      this.#contents = Buffer.concat(data);
    });

    stream.on('error', () => {
      throw new Error('MutableAsset.setStream()');
    });
  }

  getMap(): Promise<SourceMap | null | undefined> {
    // Only create the source map if it is requested
    if (!this.#sourceMap && this.#map && typeof this.#map === 'string') {
      let sourceMap = new SourceMap(this.#projectRoot);
      sourceMap.addVLQMap(JSON.parse(this.#map));
      this.#sourceMap = sourceMap;
    }

    return Promise.resolve(this.#sourceMap);
  }

  // eslint-disable-next-line no-unused-vars
  setMap(sourceMap?: SourceMap | null): void {
    this.isMapDirty = true;
    this.#sourceMap = sourceMap;
  }

  getMapBuffer(): Promise<Buffer | null | undefined> {
    throw new Error(
      'getMapBuffer() is considered an internal implementation detail, please use getMap() instead',
    );
  }

  getDependencies(): ReadonlyArray<Dependency> {
    return this.#dependencies;
  }

  // eslint-disable-next-line no-unused-vars
  addDependency(options: DependencyOptions): string {
    const id = Math.random().toString(36).slice(2);
    // @ts-expect-error: Stub implementation mismatch
    const dep: Dependency = {
      id,
      specifier: options.specifier,
      specifierType: options.specifierType,
      priority: options.priority || 'sync',
      needsStableName: options.needsStableName ?? false,
      isOptional: options.isOptional ?? false,
      isEntry: false,
      loc: options.loc,
      // @ts-expect-error: Stub implementation mismatch
      env: options.env
        ? // @ts-expect-error: Stub implementation mismatch
          {...this.env, ...options.env}
        : this.env,
      meta: options.meta || {},
      target: undefined,
      // @ts-expect-error: Stub implementation mismatch
      symbols: new MutableDependencySymbols(null),
      pipeline: options.pipeline,
      resolveFrom: options.resolveFrom,
      range: options.range,
      sourceAssetId: this.id,
      sourcePath: this.filePath,
      sourceAssetType: this.type,
      bundleBehavior: undefined,
      packageConditions: [],
    };
    this.#dependencies.push(dep);
    return id;
  }

  // eslint-disable-next-line no-unused-vars
  addURLDependency(url: string, opts: Partial<DependencyOptions>): string {
    return this.addDependency({
      ...opts,
      specifier: url,
      specifierType: 'url',
    });
  }

  // eslint-disable-next-line no-unused-vars
  setEnvironment(opts: EnvironmentOptions): void {
    // @ts-expect-error: Stub implementation mismatch
    this.env = {...this.env, ...opts};
  }

  // eslint-disable-next-line no-unused-vars
  invalidateOnFileChange(invalidation: FilePath): void {
    // TODO: Forward invalidations to Rust
  }

  // eslint-disable-next-line no-unused-vars
  invalidateOnFileCreate(invalidation: FileCreateInvalidation): void {
    // TODO: Forward invalidations to Rust
  }

  // eslint-disable-next-line no-unused-vars
  invalidateOnEnvChange(invalidation: string): void {
    // TODO: Forward invalidations to Rust
  }

  invalidateOnStartup(): void {
    // TODO: Forward invalidations to Rust
  }

  invalidateOnBuild(): void {
    // TODO: Forward invalidations to Rust
  }
}
