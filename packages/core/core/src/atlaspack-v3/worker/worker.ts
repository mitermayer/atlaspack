import assert from 'assert';
import * as napi from '@atlaspack/rust';
// @ts-expect-error TS2305
import type {JsCallable} from '@atlaspack/rust';
import {NodeFS} from '@atlaspack/fs';
import {NodePackageManager} from '@atlaspack/package-manager';
import type {
  Resolver,
  Transformer,
  Runtime,
  Namer,
  Optimizer,
  Packager,
  Validator,
  ValidateResult,
  Asset, // Add this
  FilePath,
  FileSystem,
} from '@atlaspack/types';
import SourceMap from '@atlaspack/source-map';
import {parentPort} from 'worker_threads';
import * as module from 'module';
import * as path from 'path';

import {jsCallable} from '../jsCallable';
import {
  Environment,
  Dependency,
  PluginConfig,
  PluginLogger,
  PluginTracer,
  PluginOptions,
  MutableAsset,
  bundleBehaviorMap,
  dependencyPriorityMap,
} from './compat';
import {RuntimeBundleGraph, RuntimeBundleGraphDto} from './RuntimeBundleGraph';
import {FeatureFlags} from '@atlaspack/feature-flags';

const CONFIG = Symbol.for('parcel-plugin-config');
const RPC_VERSION = 1;

export class AtlaspackWorker {
  #resolvers: Map<string, ResolverState<any>>;
  #transformers: Map<string, TransformerState<any>>;
  #runtimes: Map<string, RuntimeState<any>>;
  #namers: Map<string, NamerState<any>>;
  #optimizers: Map<string, OptimizerState<any, any>>;
  #packagers: Map<string, PackagerState<any, any>>;
  #validators: Map<string, ValidatorState<any>>;
  #fs: FileSystem;
  #packageManager: NodePackageManager;

  constructor() {
    this.#resolvers = new Map();
    this.#transformers = new Map();
    this.#runtimes = new Map();
    this.#namers = new Map();
    this.#optimizers = new Map();
    this.#packagers = new Map();
    this.#validators = new Map();
    this.#fs = new NodeFS();
    this.#packageManager = new NodePackageManager(this.#fs, '/');
  }

  handshake: JsCallable<[number], Promise<number>> = jsCallable(
    async (version) => {
      await Promise.resolve();
      if (version !== RPC_VERSION) {
        throw new Error(
          `Plugin RPC version mismatch: expected ${RPC_VERSION}, got ${version}`,
        );
      }
      return RPC_VERSION;
    },
  );

  loadPlugin: JsCallable<[LoadPluginOptions], Promise<undefined>> = jsCallable(
    async ({kind, specifier, resolveFrom, featureFlags}) => {
      // Use packageManager.require() instead of dynamic import() to support TypeScript plugins
      let resolvedModule = await this.#packageManager.require(
        specifier,
        resolveFrom,
        {shouldAutoInstall: false},
      );

      let instance = undefined;
      // Check for CommonJS export (module.exports = new Plugin(...))
      if (resolvedModule[CONFIG]) {
        instance = resolvedModule[CONFIG];
      } else if (resolvedModule.default && resolvedModule.default[CONFIG]) {
        // ESM default export
        instance = resolvedModule.default[CONFIG];
      } else if (
        resolvedModule.default &&
        resolvedModule.default.default &&
        resolvedModule.default.default[CONFIG]
      ) {
        // Double-wrapped default export
        instance = resolvedModule.default.default[CONFIG];
      } else {
        throw new Error(
          `Plugin could not be resolved\n\t${kind}\n\t${resolveFrom}\n\t${specifier}`,
        );
      }
      // Set feature flags in the worker process
      // if (featureFlags) {
      // Set feature flags in the worker process
      let featureFlagsModule = await this.#packageManager.require(
        '@atlaspack/feature-flags',
        __filename,
        {shouldAutoInstall: false},
      );
      featureFlagsModule.setFeatureFlags(featureFlags);
      // const {setFeatureFlags} = await import('@atlaspack/feature-flags');
      // setFeatureFlags(featureFlags);
      // }

      switch (kind) {
        case 'resolver':
          this.#resolvers.set(specifier, {resolver: instance});
          break;
        case 'transformer':
          this.#transformers.set(specifier, {transformer: instance});
          break;
        case 'runtime':
          this.#runtimes.set(specifier, {runtime: instance});
          break;
        case 'namer':
          this.#namers.set(specifier, {namer: instance});
          break;
        case 'optimizer':
          this.#optimizers.set(specifier, {optimizer: instance});
          break;
        case 'packager':
          this.#packagers.set(specifier, {packager: instance});
          break;
        case 'validator':
          this.#validators.set(specifier, {validator: instance});
          break;
      }
    },
  );

  runResolverResolve: JsCallable<
    [RunResolverResolveOptions],
    Promise<RunResolverResolveResult>
  > = jsCallable(
    async ({
      key,
      dependency: napiDependency,
      specifier,
      pipeline,
      pluginOptions,
    }) => {
      // ... implementation ...
      // I need to keep the implementation from previous read.
      // I cannot replace with placeholder because I need existing logic.
      // I will use replace logic on the end of the class.
      // Wait, I should just ADD the new methods.
      // I'll append them before `runTransformerTransform`.
      const state = this.#resolvers.get(key);
      if (!state) {
        throw new Error(`Resolver not found: ${key}`);
      }

      let packageManager = state.packageManager;
      if (!packageManager) {
        packageManager = new NodePackageManager(
          this.#fs,
          pluginOptions.projectRoot,
        );
        state.packageManager = packageManager;
      }

      const env = new Environment(napiDependency.env);
      const dependency = new Dependency(napiDependency, env);

      const defaultOptions = {
        logger: new PluginLogger(),
        tracer: new PluginTracer(),
        options: new PluginOptions({
          ...pluginOptions,
          packageManager,
          shouldAutoInstall: false,
          inputFS: this.#fs,
          outputFS: this.#fs,
        }),
      } as const;

      if (!('config' in state)) {
        // @ts-expect-error TS2345
        state.config = await state.resolver.loadConfig?.({
          config: new PluginConfig({
            env,
            isSource: true,
            searchPath: specifier,
            projectRoot: pluginOptions.projectRoot,
            fs: this.#fs,
            packageManager,
          }),
          ...defaultOptions,
        });
      }

      // @ts-expect-error TS2345
      const result = await state.resolver.resolve({
        specifier,
        dependency,
        pipeline,
        config: state.config,
        ...defaultOptions,
      });

      if (!result) {
        return {
          invalidations: [],
          resolution: {type: 'unresolved'},
        };
      }

      if (result.isExcluded) {
        return {
          invalidations: [],
          resolution: {type: 'excluded'},
        };
      }

      return {
        invalidations: [],
        resolution: {
          type: 'resolved',
          filePath: result.filePath || '',
          canDefer: result.canDefer || false,
          sideEffects: result.sideEffects ?? true,
          code: result.code || undefined,
          meta: result.meta || undefined,
          pipeline: result.pipeline || undefined,
          priority: dependencyPriorityMap.intoNullable(result.priority),
          query: result.query && result.query.toString(),
        },
      };
    },
  );

  runTransformerTransform: JsCallable<
    [RunTransformerTransformOptions, Buffer, string | null | undefined],
    Promise<RunTransformerTransformResult>
  > = jsCallable(
    async ({key, env: napiEnv, options, asset: innerAsset}, contents, map) => {
      const state = this.#transformers.get(key);
      if (!state) {
        throw new Error(`Transformer not found: ${key}`);
      }

      let packageManager = state.packageManager;
      if (!packageManager) {
        packageManager = new NodePackageManager(this.#fs, options.projectRoot);
        state.packageManager = packageManager;
      }

      const transformer: Transformer<any> = state.transformer;
      const resolveFunc = (from: string, to: string): Promise<any> => {
        let customRequire = module.createRequire(from);
        let resolvedPath = customRequire.resolve(to);

        return Promise.resolve(resolvedPath);
      };

      const env = new Environment(napiEnv);
      const mutableAsset = new MutableAsset(
        innerAsset,
        // @ts-expect-error TS2345
        contents,
        env,
        this.#fs,
        map,
        options.projectRoot,
      );

      const defaultOptions = {
        logger: new PluginLogger(),
        tracer: new PluginTracer(),
        options: new PluginOptions({
          ...options,
          packageManager,
          shouldAutoInstall: false,
          inputFS: this.#fs,
          outputFS: this.#fs,
        }),
      } as const;

      // @ts-expect-error TS2345
      const config = await transformer.loadConfig?.({
        config: new PluginConfig({
          env,
          isSource: true,
          searchPath: innerAsset.filePath,
          projectRoot: options.projectRoot,
          fs: this.#fs,
          packageManager,
        }),
        ...defaultOptions,
      });

      if (transformer.parse) {
        const ast = await transformer.parse({
          // @ts-expect-error TS2322
          asset: mutableAsset,
          config,
          resolve: resolveFunc,
          ...defaultOptions,
        });
        if (ast) {
          mutableAsset.setAST(ast);
        }
      }

      const result = await state.transformer.transform({
        // @ts-expect-error TS2322
        asset: mutableAsset,
        config,
        resolve: resolveFunc,
        ...defaultOptions,
      });

      if (transformer.generate) {
        const ast = await mutableAsset.getAST();
        if (ast) {
          const output = await transformer.generate({
            // @ts-expect-error TS2322
            asset: mutableAsset,
            ast,
            ...defaultOptions,
          });

          if (typeof output.content === 'string') {
            mutableAsset.setCode(output.content);
          } else if (output.content instanceof Buffer) {
            mutableAsset.setBuffer(output.content);
          } else {
            // @ts-expect-error TS2345
            mutableAsset.setStream(output.content);
          }

          if (output.map) {
            mutableAsset.setMap(output.map);
          }
        }
      }

      assert(
        result.length === 1,
        '[V3] Unimplemented: Multiple asset return from Node transformer',
      );

      assert(
        result[0] === mutableAsset,
        '[V3] Unimplemented: New asset returned from Node transformer',
      );

      let assetBuffer: Buffer | null = await mutableAsset.getBuffer();

      // If the asset has no code, we set the buffer to null, which we can
      // detect in Rust, to avoid passing back an empty buffer, which we can't.
      if (assetBuffer.length === 0) {
        assetBuffer = null;
      }

      return [
        {
          id: mutableAsset.id,
          bundleBehavior: bundleBehaviorMap.intoNullable(
            mutableAsset.bundleBehavior,
          ),
          code: [],
          filePath: mutableAsset.filePath,
          isBundleSplittable: mutableAsset.isBundleSplittable,
          isSource: mutableAsset.isSource,
          meta: mutableAsset.meta,
          pipeline: mutableAsset.pipeline,
          // Query should be undefined if it's empty
          query: mutableAsset.query.toString() || undefined,
          sideEffects: mutableAsset.sideEffects,
          symbols: mutableAsset.symbols.intoNapi(),
          type: mutableAsset.type,
          uniqueKey: mutableAsset.uniqueKey,
        },
        assetBuffer,
        // Only send back the map if it has changed
        mutableAsset.isMapDirty
          ? // @ts-expect-error TS2533
            JSON.stringify((await mutableAsset.getMap()).toVLQ())
          : '',
      ];
    },
  );

  runBundlerBundle: JsCallable<[unknown], Promise<void>> = jsCallable(
    async () => {
      await Promise.resolve();
      throw new Error('runBundlerBundle not implemented');
    },
  );

  runBundlerOptimize: JsCallable<[unknown], Promise<void>> = jsCallable(
    async () => {
      await Promise.resolve();
      throw new Error('runBundlerOptimize not implemented');
    },
  );

  runCompressorCompress: JsCallable<[unknown], Promise<void>> = jsCallable(
    async () => {
      await Promise.resolve();
      throw new Error('runCompressorCompress not implemented');
    },
  );

  runNamerName: JsCallable<[RunNamerNameOptions], Promise<RunNamerNameResult>> =
    jsCallable(
      async ({
        key,
        bundle: bundleDto,
        bundleGraph: bundleGraphDto,
        options,
      }) => {
        const state = this.#namers.get(key);
        if (!state) {
          throw new Error(`Namer not found: ${key}`);
        }

        let packageManager = state.packageManager;
        if (!packageManager) {
          packageManager = new NodePackageManager(
            this.#fs,
            options.projectRoot,
          );
          state.packageManager = packageManager;
        }

        const defaultOptions = {
          logger: new PluginLogger(),
          tracer: new PluginTracer() as any,
          options: new PluginOptions({
            ...options,
            packageManager,
            shouldAutoInstall: false,
            inputFS: this.#fs,
            outputFS: this.#fs,
          }),
        } as const;

        const bundleGraph = new RuntimeBundleGraph(bundleGraphDto);
        // TODO: Wrap bundleDto in a proper NamedBundle implementation
        const bundle = bundleDto as any;
        // TODO: construct proper Environment from bundleDto
        const env = new Environment(bundleDto.env);

        if (!('config' in state)) {
          state.config = await state.namer.loadConfig?.({
            config: new PluginConfig({
              env,
              isSource: false,
              searchPath: options.projectRoot, // Namers are usually global or per-project
              projectRoot: options.projectRoot,
              fs: this.#fs,
              packageManager,
            }),
            ...defaultOptions,
          });
        }

        const result = await state.namer.name({
          bundle,
          bundleGraph,
          config: state.config,
          ...defaultOptions,
        });

        return {
          name: result,
        };
      },
    );

  runOptimizerOptimize: JsCallable<
    [RunOptimizerOptimizeOptions],
    Promise<RunOptimizerOptimizeResult>
  > = jsCallable(
    async ({
      key,
      bundle: bundleDto,
      bundleGraph: bundleGraphDto,
      contents,
      map: mapBuffer,
      options,
    }) => {
      const state = this.#optimizers.get(key);
      if (!state) {
        throw new Error(`Optimizer not found: ${key}`);
      }

      let packageManager = state.packageManager;
      if (!packageManager) {
        packageManager = new NodePackageManager(this.#fs, options.projectRoot);
        state.packageManager = packageManager;
      }

      const defaultOptions = {
        logger: new PluginLogger(),
        tracer: new PluginTracer() as any,
        options: new PluginOptions({
          ...options,
          packageManager,
          shouldAutoInstall: false,
          inputFS: this.#fs,
          outputFS: this.#fs,
        }),
      } as const;

      const bundleGraph = new RuntimeBundleGraph(bundleGraphDto);
      // TODO: Wrap bundleDto in a proper NamedBundle implementation
      const bundle = bundleDto as any;
      const env = new Environment(bundleDto.env);

      if (!('config' in state)) {
        state.config = await state.optimizer.loadConfig?.({
          config: new PluginConfig({
            env,
            isSource: false,
            searchPath: options.projectRoot, // Optimizers are usually global or per-project
            projectRoot: options.projectRoot,
            fs: this.#fs,
            packageManager,
          }),
          ...defaultOptions,
        });
      }

      let bundleConfig;
      if (state.optimizer.loadBundleConfig) {
        bundleConfig = await state.optimizer.loadBundleConfig({
          bundle,
          bundleGraph,
          config: new PluginConfig({
            env,
            isSource: false,
            searchPath: options.projectRoot,
            projectRoot: options.projectRoot,
            fs: this.#fs,
            packageManager,
          }),
          ...defaultOptions,
        });
      }

      let map: SourceMap | undefined;
      if (mapBuffer) {
        map = new SourceMap(options.projectRoot, Buffer.from(mapBuffer));
      }

      const result = await state.optimizer.optimize({
        bundle,
        bundleGraph,
        contents,
        map,
        config: state.config,
        bundleConfig,
        getSourceMapReference: (map) => {
          // Simplified implementation
          if (map) {
            return path.basename(bundle.name || 'bundle') + '.map';
          }
          return null;
        },
        ...defaultOptions,
      });

      return {
        contents: result.contents,
        map: result.map
          ? await result.map.stringify({
              format: 'string',
            })
          : null,
      };
    },
  );

  runPackagerPackage: JsCallable<
    [RunPackagerPackageOptions],
    Promise<RunPackagerPackageResult>
  > = jsCallable(
    async ({key, bundle: bundleDto, bundleGraph: bundleGraphDto, options}) => {
      const state = this.#packagers.get(key);
      if (!state) {
        throw new Error(`Packager not found: ${key}`);
      }

      let packageManager = state.packageManager;
      if (!packageManager) {
        packageManager = new NodePackageManager(this.#fs, options.projectRoot);
        state.packageManager = packageManager;
      }

      const defaultOptions = {
        logger: new PluginLogger(),
        tracer: new PluginTracer() as any,
        options: new PluginOptions({
          ...options,
          packageManager,
          shouldAutoInstall: false,
          inputFS: this.#fs,
          outputFS: this.#fs,
        }),
      } as const;

      const bundleGraph = new RuntimeBundleGraph(bundleGraphDto);
      // TODO: Wrap bundleDto in a proper NamedBundle implementation
      const bundle = bundleDto as any;
      const env = new Environment(bundleDto.env);

      if (!('config' in state)) {
        state.config = await state.packager.loadConfig?.({
          config: new PluginConfig({
            env,
            isSource: false,
            searchPath: options.projectRoot,
            projectRoot: options.projectRoot,
            fs: this.#fs,
            packageManager,
          }),
          ...defaultOptions,
        });
      }

      let bundleConfig;
      if (state.packager.loadBundleConfig) {
        bundleConfig = await state.packager.loadBundleConfig({
          bundle,
          bundleGraph,
          config: new PluginConfig({
            env,
            isSource: false,
            searchPath: options.projectRoot,
            projectRoot: options.projectRoot,
            fs: this.#fs,
            packageManager,
          }),
          ...defaultOptions,
        });
      }

      const result = await state.packager.package({
        bundle,
        bundleGraph,
        config: state.config,
        bundleConfig,
        getSourceMapReference: (map) => {
          if (map) {
            return path.basename(bundle.name || 'bundle') + '.map';
          }
          return null;
        },
        getInlineBundleContents: async (bundle, bundleGraph) => {
          // TODO: Implement getInlineBundleContents if needed
          return {contents: ''};
        },
        ...defaultOptions,
      });

      return {
        contents: result.contents,
        map: result.map
          ? await result.map.stringify({
              format: 'string',
            })
          : null,
      };
    },
  );

  runValidatorValidate: JsCallable<
    [RunValidatorValidateOptions, Buffer, string | null | undefined],
    Promise<ValidateResult | undefined | void>
  > = jsCallable(
    async ({key, env: napiEnv, options, asset: innerAsset}, contents, map) => {
      const state = this.#validators.get(key);
      if (!state) {
        throw new Error(`Validator not found: ${key}`);
      }

      const validator = state.validator;
      if (!('validate' in validator)) {
        throw new Error(`Validator ${key} is not a MultiThreadValidator`);
      }

      let packageManager = state.packageManager;
      if (!packageManager) {
        packageManager = new NodePackageManager(this.#fs, options.projectRoot);
        state.packageManager = packageManager;
      }

      // Validator usually runs on source assets, so Environment from asset is used.
      const env = new Environment(napiEnv);

      const mutableAsset = new MutableAsset(
        innerAsset,
        contents as Buffer,
        env,
        this.#fs,
        map as string | null | undefined,
        options.projectRoot,
      );

      const defaultOptions = {
        logger: new PluginLogger(),
        tracer: new PluginTracer() as any,
        options: new PluginOptions({
          ...options,
          packageManager,
          shouldAutoInstall: false,
          inputFS: this.#fs,
          outputFS: this.#fs,
        }),
      } as const;

      if (!('config' in state)) {
        if (validator.getConfig) {
          state.config = await validator.getConfig({
            asset: mutableAsset as unknown as Asset,
            resolveConfig: async (_configNames) => {
              // TODO: Implement resolveConfig via RPC or FS
              return null;
            },
            ...defaultOptions,
          });
        }
      }

      const result = await validator.validate({
        asset: mutableAsset as unknown as Asset,
        config: state.config,
        ...defaultOptions,
      });

      return result;
    },
  );

  runReporterReport: JsCallable<[unknown], Promise<void>> = jsCallable(
    async (event) => {
      await Promise.resolve();
      if (parentPort) {
        parentPort.postMessage({type: 'report', event});
      }
    },
  );

  runRuntimeApply: JsCallable<
    [RunRuntimeApplyOptions],
    Promise<RunRuntimeApplyResult>
  > = jsCallable(
    async ({key, bundle: bundleDto, bundleGraph: bundleGraphDto, options}) => {
      const state = this.#runtimes.get(key);
      if (!state) {
        throw new Error(`Runtime not found: ${key}`);
      }

      let packageManager = state.packageManager;
      if (!packageManager) {
        packageManager = new NodePackageManager(this.#fs, options.projectRoot);
        state.packageManager = packageManager;
      }

      const defaultOptions = {
        logger: new PluginLogger(),
        tracer: new PluginTracer() as any,
        options: new PluginOptions({
          ...options,
          packageManager,
          shouldAutoInstall: false,
          inputFS: this.#fs,
          outputFS: this.#fs,
        }),
      } as const;

      // TODO: construct proper Environment from bundleDto
      // For now we assume bundleDto has env property that matches what Environment expects or we mock it.
      // In V3, bundleDto.env is likely a Napi Environment struct.
      const env = new Environment(bundleDto.env);

      const config = await state.runtime.loadConfig?.({
        config: new PluginConfig({
          env,
          isSource: false,
          searchPath: options.projectRoot, // Runtimes are usually global or per-project
          projectRoot: options.projectRoot,
          fs: this.#fs,
          packageManager,
        }),
        ...defaultOptions,
      });

      const bundleGraph = new RuntimeBundleGraph(bundleGraphDto);

      // TODO: Wrap bundleDto in a proper NamedBundle implementation
      // For now casting it to any to satisfy TS, assuming Rust sends a compatible structure or we will fix it later.
      const bundle = bundleDto as any;

      const result = await state.runtime.apply({
        bundle,
        bundleGraph,
        config,
        ...defaultOptions,
      });

      if (!result) {
        return {assets: []};
      }

      const assets = Array.isArray(result) ? result : [result];

      return {
        assets: assets.map((asset) => ({
          filePath: asset.filePath,
          code: asset.code,
          isEntry: asset.isEntry,
          dependency: asset.dependency
            ? {
                id: asset.dependency.id,
                specifier: asset.dependency.specifier,
                specifierType: asset.dependency.specifierType,
                priority: dependencyPriorityMap.intoNullable(
                  asset.dependency.priority,
                ),
                isEntry: asset.dependency.isEntry,
                isOptional: asset.dependency.isOptional,
                loc: asset.dependency.loc,
                env: asset.dependency.env,
                meta: asset.dependency.meta,
                target: asset.dependency.target,
                sourceAssetId: asset.dependency.sourceAssetId,
                sourcePath: asset.dependency.sourcePath,
                pipeline: asset.dependency.pipeline,
                symbols: asset.dependency.symbols,
              }
            : undefined,
        })),
      };
    },
  );
}

// Create napi worker and send it back to main thread
const worker = new AtlaspackWorker();
// @ts-expect-error newNodejsWorker is now async because of handshake
napi.newNodejsWorker(worker).then((napiWorker) => {
  parentPort?.postMessage(napiWorker);
});

type ResolverState<T> = {
  resolver: Resolver<T>;
  config?: T;
  packageManager?: NodePackageManager;
};

type TransformerState<T> = {
  packageManager?: NodePackageManager;
  transformer: Transformer<T>;
};

type NamerState<T> = {
  packageManager?: NodePackageManager;
  namer: Namer<T>;
  config?: T;
};

type LoadPluginOptions = {
  kind:
    | 'resolver'
    | 'transformer'
    | 'runtime'
    | 'namer'
    | 'optimizer'
    | 'packager'
    | 'validator';
  specifier: string;
  resolveFrom: string;
  featureFlags?: FeatureFlags;
};

type RpcPluginOptions = {
  projectRoot: string;
  mode: string;
};

type RunResolverResolveOptions = {
  key: string;
  // @ts-expect-error TS2694
  dependency: napi.Dependency;
  specifier: FilePath;
  pipeline: string | null | undefined;
  pluginOptions: RpcPluginOptions;
};

type RunResolverResolveResult = {
  invalidations: Array<any>;
  resolution:
    | {
        type: 'unresolved';
      }
    | {
        type: 'excluded';
      }
    | {
        type: 'resolved';
        canDefer: boolean;
        filePath: string;
        sideEffects: boolean;
        code?: string;
        meta?: unknown;
        pipeline?: string;
        priority?: number | null | undefined;
        query?: string;
      };
};

type RunTransformerTransformOptions = {
  key: string;
  // @ts-expect-error TS2724
  env: napi.Environment;
  options: RpcPluginOptions;
  // @ts-expect-error TS2694
  asset: napi.Asset;
};

// @ts-expect-error TS2694
type RunTransformerTransformResult = [napi.RpcAssetResult, Buffer, string];

type RuntimeState<T> = {
  packageManager?: NodePackageManager;
  runtime: Runtime<T>;
};

type RunRuntimeApplyOptions = {
  key: string;
  bundle: any;
  bundleGraph: RuntimeBundleGraphDto;
  options: RpcPluginOptions;
};

type RunRuntimeApplyResult = {
  assets: Array<{
    filePath: string;
    code: string;
    isEntry?: boolean;
    dependency?: any;
  }>;
};

type RunNamerNameOptions = {
  key: string;
  bundle: any;
  bundleGraph: RuntimeBundleGraphDto;
  options: RpcPluginOptions;
};

type RunNamerNameResult = {
  name: string | null | undefined;
};

type OptimizerState<T, U> = {
  packageManager?: NodePackageManager;
  optimizer: Optimizer<T, U>;
  config?: T;
};

type RunOptimizerOptimizeOptions = {
  key: string;
  bundle: any;
  bundleGraph: RuntimeBundleGraphDto;
  contents: any;
  map?: Buffer | string | null;
  options: RpcPluginOptions;
};

type RunOptimizerOptimizeResult = {
  contents: any;
  map?: string | null;
};

type PackagerState<T, U> = {
  packageManager?: NodePackageManager;
  packager: Packager<T, U>;
  config?: T;
};

type RunPackagerPackageOptions = {
  key: string;
  bundle: any;
  bundleGraph: RuntimeBundleGraphDto;
  options: RpcPluginOptions;
};

type RunPackagerPackageResult = {
  contents: any;
  map?: string | null;
};

type ValidatorState<T> = {
  packageManager?: NodePackageManager;
  validator: Validator;
  config?: T;
};

type RunValidatorValidateOptions = {
  key: string;
  // @ts-expect-error TS2724
  env: napi.Environment;
  options: RpcPluginOptions;
  // @ts-expect-error TS2694
  asset: napi.Asset;
};
