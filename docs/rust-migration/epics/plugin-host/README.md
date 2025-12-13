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
- Implemented `BundleGraph` serialization and NAPI bindings (`atlaspack_napi_build_bundle_graph`).

## Technical Gaps (Future Work)

- **Argument Marshalling**: Currently, `bundleGraph` is passed as `null` in RPC calls. NAPI wrappers are implemented but RPC arguments need to be updated to use them (or use serialized graph transfer).
- **Plugin Context**: `PluginContext` serialization is minimal.
- **Error Handling**: JS error conversion needs refinement.

## Tasks

- [x] Enhance `RpcWorker` to support all plugin types (Bindings added).
- [x] Implement `NodejsRpcBundlerPlugin` as a proof of concept.
- [x] Implement remaining RPC plugins (Namer, Optimizer, Packager, Compressor, Reporter, Runtime).
- [x] Implement `BundleGraph` NAPI wrapper (`atlaspack_napi_build_bundle_graph` and `serialize_bundle_graph`).
- [ ] Update RPC plugins to pass serialized graph or handle.
- [ ] Implement `PluginContext` marshalling.
- [ ] Add support for "NAPI" plugins (in-process).
- [ ] Verify error propagation across the bridge.
