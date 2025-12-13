# Ticket: Cache Integration and Schema Versioning

## Objective

Wire Rust orchestrator to LMDB cache with versioned keys, detection, and safe invalidate/migrate behavior.

## Tasks

- [x] Implement `Serialize` and `Deserialize` for `RequestGraph` and nodes.
- [x] Implement `Serialize` and `Deserialize` for `AssetGraph`.
- [x] Implement `Serialize` and `Deserialize` for `BundleGraph`.
- [x] Implement `RequestTracker::write_to_cache` to serialize and write the graph to LMDB.
- [x] Implement `RequestTracker` initialization to read from cache.
- [ ] Define schema versioning and mismatch detection.

## Acceptance Criteria

- On version mismatch, build either migrates or invalidates cleanly with user-visible notice.
- Hash parity confirmed on fixtures where formats match; exceptions documented.
- Guardrails prevent silent schema drift (tests/checks in-repo); integration CI can run them, but no CI wiring here.
