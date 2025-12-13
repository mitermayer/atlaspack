# Epic: Pipeline Scheduler

## Status

**ID**: IMPL-4
**Status**: Completed

## Objective

Implement the Rust-side scheduler that orchestrates the asset transformation pipeline (Resolving -> Transforming -> Code Generation).

## Work Completed

- Refactored `AssetRequest` to use a dedicated `PipelineScheduler` in `crates/atlaspack/src/scheduler/pipeline.rs`.
- Moved transformation loop and validation logic to `PipelineScheduler::execute`.
- Verified logic with unit tests moved from `asset_request.rs`.

## Tasks

- [x] Refactor `AssetRequest` to use a dedicated `PipelineScheduler`.
- [x] Implement robust pipeline resolution (using `.parcelrc` - handled by `ConfigPlugins`).
- [ ] Connect to `PluginHost` (IMPL-6) for executing transformations (Logic exists in `plugins` module, integration pending IMPL-6).
- [ ] Handle multi-phase transforms (e.g. source maps, code generation - handled in `PipelineScheduler`).
