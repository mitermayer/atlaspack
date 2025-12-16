use std::path::PathBuf;

use anyhow::Result;
use async_trait::async_trait;
use atlaspack_core::bundle_graph::{BundleGraph, BundleGraphNode};
use atlaspack_core::plugin::NamerPlugin;
use atlaspack_core::types::Bundle;
use serde::Deserialize;

#[derive(Debug, Default)]
pub struct DefaultNamerPlugin;

#[derive(Debug, Deserialize, Default)]
struct DefaultNamerConfig {
  // Add config fields if needed, mirroring JS side
}

#[async_trait]
impl NamerPlugin for DefaultNamerPlugin {
  async fn name(&self, bundle: &Bundle, bundle_graph: &BundleGraph) -> Result<Option<PathBuf>> {
    // 1. Entry Bundles
    // Find the main entry asset from the graph
    let entry_asset = if let Some(id) = &bundle.main_entry_id {
      // This is inefficient but necessary given current API limitations
      bundle_graph.graph.node_weights().find_map(|node| {
        if let BundleGraphNode::Asset(a) = node {
          if a.id == *id {
            Some(a)
          } else {
            None
          }
        } else {
          None
        }
      })
    } else {
      None
    };

    if let Some(entry_asset) = entry_asset {
      // Check if there's a target distEntry
      if let Some(dist_entry) = &bundle.target.dist_entry {
        return Ok(Some(PathBuf::from(dist_entry)));
      }

      // Name based on entry asset path
      // For now, we use the file name as we don't have access to project_root to calculate relative path
      let entry_path = &entry_asset.file_path;

      // Apply extension based on output format/type
      let mut name = PathBuf::from(entry_path.file_name().unwrap_or_default());

      // If it's index.js, maybe rename to parent dir name
      if name.file_stem().map_or(false, |s| s == "index") {
        if let Some(parent) = entry_path.parent() {
          if let Some(file_name) = parent.file_name() {
            name.set_file_name(file_name);
          }
        }
      }

      // Add hash if needed (not for entry bundles usually unless requested)
      if !bundle.needs_stable_name {
        let hash = &bundle.id[..8]; // Using ID as hash proxy
        let stem = name.file_stem().unwrap_or_default().to_string_lossy();
        let ext = name.extension().unwrap_or_default().to_string_lossy();
        let new_name = format!("{}.{}.{}", stem, hash, ext);
        name.set_file_name(new_name);
      }

      return Ok(Some(name));
    }

    // 2. Shared Bundles (no entry)
    // Name by hash
    let hash = &bundle.id[..8]; // Using ID as hash proxy
    let ext = bundle.bundle_type.extension();
    Ok(Some(PathBuf::from(format!("{}.{}", hash, ext))))
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use atlaspack_core::types::{Asset, Bundle, Target};
  use std::sync::Arc;

  #[tokio::test]
  async fn test_name_entry_bundle() {
    // Mock bundle with entry asset
    let mut bundle = Bundle {
      id: "bundle1".into(),
      bundle_behavior: None,
      bundle_type: atlaspack_core::types::FileType::Js,
      entry_asset_ids: vec!["asset1".into()],
      env: Default::default(),
      hash_reference: "hash".into(),
      is_splittable: true,
      main_entry_id: Some("asset1".into()),
      manual_shared_bundle: None,
      name: None,
      needs_stable_name: false,
      pipeline: None,
      public_id: Some("pubid".into()),
      target: Target {
        dist_entry: Some("out/index.js".into()),
        ..Target::default()
      },
    };

    // Mock graph
    let mut bundle_graph = BundleGraph::new();
    let mut asset = Asset::default();
    asset.id = "asset1".into();
    asset.file_path = PathBuf::from("/project/src/index.js");

    bundle_graph
      .graph
      .add_node(BundleGraphNode::Asset(Arc::new(asset)));

    let plugin = DefaultNamerPlugin;
    let result = plugin.name(&bundle, &bundle_graph).await;

    assert!(result.is_ok());
    let path = result.unwrap();
    assert_eq!(path, Some(PathBuf::from("out/index.js")));
  }
}
