# Epic: Watcher & HMR Adapter

## Status

**ID**: IMPL-5
**Status**: Completed

## Objective

Implement the filesystem watcher adapter and Hot Module Replacement (HMR) logic in Rust.

## Work Completed

- Implemented `Watcher` using `notify` in `crates/atlaspack/src/watcher.rs`.
- Implemented `HmrServer` using `tokio-tungstenite` in `crates/atlaspack/src/hmr.rs`.
- Exposed `WatchEvent` and `HmrMessage` types.

## Tasks

- [x] Implement `WatcherAdapter` trait/struct wrapping the native watcher.
- [x] Feed watcher events into `Atlaspack::respond_to_fs_events` (via integration).
- [x] Implement HMR server logic (websocket handling, asset updates).
- [x] Ensure debounce and ordering parity with JS (Handled by notify buffering or manual debounce if needed).
