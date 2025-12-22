import type {
  PluginOptions as IPluginOptions,
  LogLevel,
  FileSystem,
  PackageManager,
  EnvMap,
  FilePath,
  HMROptions,
  ServerOptions,
  DetailedReportOptions,
  BuildMode,
} from '@atlaspack/types';
import type {FeatureFlags} from '@atlaspack/feature-flags';
import * as path from 'path';

// Based on crates/atlaspack_plugin_rpc/src/nodejs/plugins/plugin_options.rs
type RpcHmrOptions = {
  port?: number | null;
  host?: string | null;
};

type RpcPluginOptions = {
  hmrOptions?: RpcHmrOptions | null;
  projectRoot: string;
  mode: BuildMode;
  env?: EnvMap;
};

type WorkerOptions = RpcPluginOptions & {
  packageManager: PackageManager;
  shouldAutoInstall: boolean;
  inputFS: FileSystem;
  outputFS: FileSystem;
};

export class PluginOptions implements IPluginOptions {
  #options: WorkerOptions | Partial<IPluginOptions>;

  constructor(options: WorkerOptions | Partial<IPluginOptions>) {
    this.#options = options;
  }

  get env(): EnvMap {
    if ('env' in this.#options && this.#options.env) {
      return this.#options.env;
    }
    return process.env;
  }

  get projectRoot(): FilePath {
    return this.#options.projectRoot!;
  }

  get packageManager(): PackageManager {
    return this.#options.packageManager!;
  }

  get mode(): BuildMode {
    return this.#options.mode || 'development';
  }

  get parcelVersion(): string {
    return 'UNKNOWN VERSION';
  }

  get hmrOptions(): HMROptions | null | undefined {
    if (this.#options.hmrOptions) {
      return {
        port: this.#options.hmrOptions.port ?? undefined,
        host: this.#options.hmrOptions.host ?? undefined,
      };
    }
    return null;
  }

  get serveOptions(): ServerOptions | false {
    // Not implemented in RpcPluginOptions yet, defaulting to false
    if ('serveOptions' in this.#options) {
      return this.#options.serveOptions as ServerOptions | false;
    }
    return false;
  }

  get shouldBuildLazily(): boolean {
    return (
      ('shouldBuildLazily' in this.#options &&
        this.#options.shouldBuildLazily) ||
      false
    );
  }

  get shouldAutoInstall(): boolean {
    return (
      ('shouldAutoInstall' in this.#options &&
        this.#options.shouldAutoInstall) ||
      false
    );
  }

  get logLevel(): LogLevel {
    if ('logLevel' in this.#options) {
      return this.#options.logLevel as LogLevel;
    }
    return 'info';
  }

  get cacheDir(): string {
    if ('cacheDir' in this.#options && this.#options.cacheDir) {
      return this.#options.cacheDir;
    }
    return path.join(this.projectRoot, '.parcel-cache');
  }

  get inputFS(): FileSystem {
    return this.#options.inputFS!;
  }

  get outputFS(): FileSystem {
    return this.#options.outputFS!;
  }

  get instanceId(): string {
    if ('instanceId' in this.#options && this.#options.instanceId) {
      return this.#options.instanceId;
    }
    return 'instance-id'; // Default or throw?
  }

  get detailedReport(): DetailedReportOptions | null | undefined {
    if ('detailedReport' in this.#options) {
      return this.#options.detailedReport;
    }
    return null;
  }

  get featureFlags(): FeatureFlags {
    if ('featureFlags' in this.#options && this.#options.featureFlags) {
      return this.#options.featureFlags as FeatureFlags;
    }
    // TODO: Need to handle feature flags
    return {} as FeatureFlags;
  }
}
