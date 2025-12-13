# Epic: Plugin Host Bridge

## Status

**ID**: IMPL-6
**Status**: In Progress

## Objective

Create the bridge between the Rust core and the JS/Rust plugins.

## Work Completed

- Added bindings for all plugin lifecycle methods (`runBundlerBundle`, `runNamerName`, etc.) to `NodejsWorker`.
- Wired `NodejsRpcBundlerPlugin` to call the JS worker via RPC.
- Updated `NodejsWorkerFarm` to inject workers into the plugin.

## Technical Gaps & Next Steps

- **Argument Marshalling**: Currently, `bundleGraph` is passed as `null`. We need to implement NAPI wrappers for `BundleGraph`, `AssetGraph`, and `Asset` so they can be passed to JS plugins. This requires a dedicated "Interop" epic or extensive work on `node-bindings`.
- **Plugin Context**: `PluginContext` serialization is stubbed. We need to serialize/deserialize logger options, inputs, etc.
- **Error Handling**: JS errors need to be converted to Rust `anyhow::Error` or `Diagnostic` with stack traces preserved.
- **Completeness**: Apply the `NodejsRpcBundlerPlugin` pattern to Namer, Optimizer, Packager, Compressor, Reporter, and Runtime plugins.

## Tasks

- [x] Enhance `RpcWorker` to support all plugin types (Bindings added).
- [x] Implement `NodejsRpcBundlerPlugin` as a proof of concept.
- [ ] Implement `BundleGraph` NAPI wrapper (Major Dependency).
- [ ] Implement remaining RPC plugins (Namer, Optimizer, etc.).
- [ ] Implement `PluginContext` marshalling.
- [ ] Add support for "NAPI" plugins (in-process).
- [ ] Verify error propagation across the bridge.
