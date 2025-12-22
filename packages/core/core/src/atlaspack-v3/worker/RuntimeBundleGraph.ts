import type {
  Asset,
  BundleGraph,
  BundleGraphTraversable,
  BundleGroup,
  Dependency,
  ExportSymbolResolution,
  FilePath,
  GraphVisitor,
  NamedBundle,
  Symbol,
  SymbolResolution,
  Target,
} from '@atlaspack/types';

export interface BundleGroupDto {
  id: string;
  entryAssetId: string;
  bundles: string[];
}

export interface RuntimeBundleGraphDto {
  resolutions: Record<string, string>;
  bundleGroups: Record<string, BundleGroupDto>;
}

export class RuntimeBundleGraph implements BundleGraph<NamedBundle> {
  #dto: RuntimeBundleGraphDto;

  constructor(dto: RuntimeBundleGraphDto) {
    this.#dto = dto;
  }

  getAssetById(_id: string): Asset {
    throw new Error('getAssetById is not implemented in RuntimeBundleGraph');
  }

  getAssetPublicId(asset: Asset): string {
    return asset.id;
  }

  isDependencySkipped(_dep: Dependency): boolean {
    return false;
  }

  getResolvedAsset(
    _dep: Dependency,
    _bundle?: NamedBundle | null,
  ): Asset | null | undefined {
    return null;
  }

  getIncomingDependencies(_asset: Asset): Array<Dependency> {
    return [];
  }

  getAssetWithDependency(_dep: Dependency): Asset | null | undefined {
    return null;
  }

  getBundleGroupsContainingBundle(_bundle: NamedBundle): Array<BundleGroup> {
    return [];
  }

  getReferencedBundles(
    _bundle: NamedBundle,
    _opts?: {recursive?: boolean; includeInline?: boolean},
  ): Array<NamedBundle> {
    return [];
  }

  getReferencingBundles(_bundle: NamedBundle): Array<NamedBundle> {
    return [];
  }

  resolveAsyncDependency(
    dependency: Dependency,
    _bundle?: NamedBundle | null,
  ):
    | {type: 'bundle_group'; value: BundleGroup}
    | {type: 'asset'; value: Asset}
    | null
    | undefined {
    const bundleGroupId = this.#dto.resolutions[dependency.id];
    if (bundleGroupId != null) {
      const bundleGroupDto = this.#dto.bundleGroups[bundleGroupId];
      if (bundleGroupDto) {
        return {
          type: 'bundle_group',
          value: {
            entryAssetId: bundleGroupDto.entryAssetId,
            target: null as any, // Target is not available in DTO
            // @ts-expect-error: Stub implementation mismatch
            id: bundleGroupId,
          },
        };
      }
    }
    return null;
  }

  getReferencedBundle(
    _dependency: Dependency,
    _bundle: NamedBundle,
  ): NamedBundle | null | undefined {
    return null;
  }

  getDependencies(_asset: Asset): Array<Dependency> {
    return [];
  }

  isAssetReachableFromBundle(_asset: Asset, _bundle: NamedBundle): boolean {
    return false;
  }

  isAssetReferenced(_bundle: NamedBundle, _asset: Asset): boolean {
    return false;
  }

  isAssetReferencedFastCheck(
    _bundle: NamedBundle,
    _asset: Asset,
  ): boolean | null {
    return null;
  }

  getReferencedAssets(_bundle: NamedBundle): Set<Asset> {
    return new Set();
  }

  hasParentBundleOfType(_bundle: NamedBundle, _type: string): boolean {
    return false;
  }

  getBundlesInBundleGroup(
    bundleGroup: BundleGroup,
    _opts?: {includeInline: boolean},
  ): Array<NamedBundle> {
    // @ts-expect-error: Stub implementation mismatch
    const id = bundleGroup.id;
    if (id != null) {
      const dto = this.#dto.bundleGroups[id];
      if (dto) {
        return dto.bundles.map(
          (bundleId) =>
            ({
              id: bundleId,
              publicId: bundleId,
            }) as unknown as NamedBundle,
        );
      }
    }
    return [];
  }

  getBundles(_opts?: {includeInline: boolean}): Array<NamedBundle> {
    return [];
  }

  isEntryBundleGroup(_bundleGroup: BundleGroup): boolean {
    return false;
  }

  getChildBundles(_bundle: NamedBundle): Array<NamedBundle> {
    return [];
  }

  getParentBundles(_bundle: NamedBundle): Array<NamedBundle> {
    return [];
  }

  getSymbolResolution(
    _asset: Asset,
    _symbol: Symbol,
    _boundary?: NamedBundle | null,
  ): SymbolResolution {
    throw new Error(
      'getSymbolResolution is not implemented in RuntimeBundleGraph',
    );
  }

  getExportedSymbols(
    _asset: Asset,
    _boundary?: NamedBundle | null,
  ): Array<ExportSymbolResolution> {
    return [];
  }

  traverse<TContext>(
    _visit: GraphVisitor<BundleGraphTraversable, TContext>,
    _start?: Asset | null,
    _opts?: {skipUnusedDependencies?: boolean} | null,
  ): TContext | null | undefined {
    return null;
  }

  traverseBundles<TContext>(
    _visit: GraphVisitor<NamedBundle, TContext>,
    _startBundle?: NamedBundle | null,
  ): TContext | null | undefined {
    return null;
  }

  getBundlesWithAsset(_asset: Asset): Array<NamedBundle> {
    return [];
  }

  getBundlesWithDependency(_dependency: Dependency): Array<NamedBundle> {
    return [];
  }

  getUsedSymbols(
    _v: Asset | Dependency,
  ): ReadonlySet<Symbol> | null | undefined {
    return null;
  }

  getEntryRoot(_target: Target): FilePath {
    throw new Error('getEntryRoot is not implemented in RuntimeBundleGraph');
  }

  getConditionsForDependencies(
    _deps: Array<Dependency>,
    _bundle: NamedBundle,
  ): Set<{
    publicId: string;
    key: string;
    ifTrueDependency: Dependency;
    ifFalseDependency: Dependency;
    ifTrueBundles: Array<NamedBundle>;
    ifFalseBundles: Array<NamedBundle>;
    ifTrueAssetId: string;
    ifFalseAssetId: string;
  }> {
    return new Set();
  }

  getConditionalBundleMapping(): Map<
    string,
    Map<
      string,
      {
        bundle: NamedBundle;
        ifTrueBundles: Array<NamedBundle>;
        ifFalseBundles: Array<NamedBundle>;
      }
    >
  > {
    return new Map();
  }

  getReferencedConditionalBundles(_bundle: NamedBundle): Array<NamedBundle> {
    return [];
  }
}
