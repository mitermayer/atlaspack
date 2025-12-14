import type {Cache} from './types';

export interface CacheSchemaVersion {
  version: string;
  migration?: (cache: Cache) => Promise<void>;
}

export class CacheSchemaManager {
  private versions: Map<string, CacheSchemaVersion> = new Map();
  private currentVersion: string = '1.2.0';

  constructor() {
    this.registerDefaultVersions();
  }

  private registerDefaultVersions(): void {
    // Version 1.0.0: Initial cache schema
    this.registerVersion({
      version: '1.0.0',
    });

    // Version 1.1.0: Added hash parity tracking
    this.registerVersion({
      version: '1.1.0',
      migration: async (cache: Cache) => {
        // Migration logic for hash parity tracking
        // This would be implemented when we need to migrate existing caches
      },
    });

    // Version 1.2.0: Added WASM fallback metadata
    this.registerVersion({
      version: '1.2.0',
      migration: async (cache: Cache) => {
        // Migration logic for WASM fallback metadata
      },
    });
  }

  registerVersion(version: CacheSchemaVersion): void {
    this.versions.set(version.version, version);
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  setCurrentVersion(version: string): void {
    if (!this.versions.has(version)) {
      throw new Error(`Unknown cache schema version: ${version}`);
    }
    this.currentVersion = version;
  }

  async migrateCache(cache: Cache, fromVersion?: string): Promise<void> {
    const storedVersion = fromVersion || (await this.getStoredVersion(cache));
    const targetVersion = this.currentVersion;

    if (storedVersion === targetVersion) {
      return; // No migration needed
    }

    const migrationPath = this.getMigrationPath(storedVersion, targetVersion);

    for (const version of migrationPath) {
      const schemaVersion = this.versions.get(version);
      if (schemaVersion?.migration) {
        await schemaVersion.migration(cache);
      }
    }

    await this.setStoredVersion(cache, targetVersion);
  }

  private async getStoredVersion(cache: Cache): Promise<string> {
    try {
      const versionData = await cache.get<string>('__cache_schema_version__');
      return versionData || '1.0.0'; // Default version if not found
    } catch {
      return '1.0.0'; // Default version for new caches
    }
  }

  private async setStoredVersion(cache: Cache, version: string): Promise<void> {
    await cache.set('__cache_schema_version__', version);
  }

  private getMigrationPath(from: string, to: string): string[] {
    const allVersions = Array.from(this.versions.keys()).sort(
      this.compareVersions,
    );
    const fromIndex = allVersions.indexOf(from);
    const toIndex = allVersions.indexOf(to);

    if (fromIndex === -1) {
      throw new Error(`Unknown source version: ${from}`);
    }

    if (toIndex === -1) {
      throw new Error(`Unknown target version: ${to}`);
    }

    if (fromIndex >= toIndex) {
      return []; // No migration needed or downgrade not supported
    }

    return allVersions.slice(fromIndex + 1, toIndex + 1);
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart !== bPart) {
        return aPart - bPart;
      }
    }

    return 0;
  }

  isVersionCompatible(version: string): boolean {
    try {
      this.getMigrationPath(version, this.currentVersion);
      return true;
    } catch {
      return false;
    }
  }
}
