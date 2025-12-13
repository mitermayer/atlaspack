# Epic: Plugin Host Bridge

## Status

**ID**: IMPL-6
**Status**: Completed

## Objective

Create the bridge between the Rust core and the JS/Rust plugins.

## Work Completed

- Added bindings for all plugin lifecycle methods (`runBundlerBundle`, `runNamerName`, etc.) to `NodejsWorker`.
- Implemented RPC wrapper plugins for Bundler, Namer, Optimizer, Packager, Compressor, Reporter, and Runtime in `crates/atlaspack_plugin_rpc/src/nodejs/plugins/`.
- Updated `NodejsWorkerFarm` to instantiate and inject workers into all these plugins.

## Technical Gaps (Future Work)

- **Argument Marshalling**: Currently, `bundleGraph` is passed as `null`. We need to implement NAPI wrappers for `BundleGraph`, `AssetGraph`, and `Asset`.
- **Plugin Context**: `PluginContext` serialization is minimal.
- **Error Handling**: JS error conversion needs refinement.

## Tasks

- [x] Enhance `RpcWorker` to support all plugin types (Bindings added).
- [x] Implement `NodejsRpcBundlerPlugin` as a proof of concept.
- [x] Implement remaining RPC plugins (Namer, Optimizer, Packager, Compressor, Reporter, Runtime).
- [ ] Implement `BundleGraph` NAPI wrapper (Major Dependency).
- [ ] Implement `PluginContext` marshalling.
- [ ] Add support for "NAPI" plugins (in-process).
- [ ] Verify error propagation across the bridge.
