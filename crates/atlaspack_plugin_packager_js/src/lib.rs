use anyhow::Result;
use async_trait::async_trait;
use atlaspack_core::asset_graph::{AssetGraph, AssetGraphNode};
use atlaspack_core::bundle_graph::{BundleGraphEdgeType, BundleGraphNode};
use atlaspack_core::plugin::{PackageContext, PackagedBundle, PackagerPlugin};
use petgraph::visit::EdgeRef;
use serde_json::json;

#[derive(Debug, Default)]
pub struct AtlaspackJsPackagerPlugin;

impl AtlaspackJsPackagerPlugin {
  pub fn new() -> Self {
    Self
  }
}

#[async_trait]
impl PackagerPlugin for AtlaspackJsPackagerPlugin {
  async fn package<'a>(&self, ctx: PackageContext<'a>) -> Result<PackagedBundle> {
    let bundle = ctx.bundle;
    let bundle_graph = ctx.bundle_graph;
    let asset_graph = ctx.asset_graph;

    // 1. Find Bundle Node Index
    let bundle_node_idx = bundle_graph
      .graph
      .node_indices()
      .find(|&idx| {
        if let BundleGraphNode::Bundle(b) = &bundle_graph.graph[idx] {
          b.id == bundle.id
        } else {
          false
        }
      })
      .ok_or_else(|| anyhow::anyhow!("Bundle not found in graph"))?;

    // 2. Collect Assets
    let mut assets_code = Vec::new();
    let neighbors = bundle_graph
      .graph
      .edges_directed(bundle_node_idx, petgraph::Direction::Outgoing);

    for edge in neighbors {
      if *edge.weight() == BundleGraphEdgeType::Contains {
        let target_idx = edge.target();
        if let BundleGraphNode::Asset(asset) = &bundle_graph.graph[target_idx] {
          // Get code
          let code = asset.code.as_str().unwrap_or("").to_string();

          // Get dependencies (Naive: traverse AssetGraph for now)
          // We need to find the asset in AssetGraph to get dependencies.
          // Assuming AssetGraph has same asset ID structure or we can find it.
          // AssetGraph lookup by ID?
          // Linear scan of AssetGraph :(
          // This will be slow but functional for MVP.
          // TODO: Optimize lookup.

          let mut deps_map = serde_json::Map::new();

          if let Some(asset_graph_node_id) = asset_graph.nodes().position(|n| {
            if let AssetGraphNode::Asset(a) = n {
              a.id == asset.id
            } else {
              false
            }
          }) {
            // Find dependency edges
            for dep_idx in asset_graph.get_outgoing_neighbors(&asset_graph_node_id) {
              if let Some(AssetGraphNode::Dependency(dep)) = asset_graph.get_node(&dep_idx) {
                // Resolve dependency to asset ID
                // We need to find where this dependency points to (resolution).
                // In AssetGraph, deps point to Assets.
                // But resolution might be conditional or deferred.
                // Let's check outgoing neighbors of dependency.
                let targets = asset_graph.get_outgoing_neighbors(&dep_idx);
                if let Some(target_id) = targets.first() {
                  if let Some(AssetGraphNode::Asset(target_asset)) = asset_graph.get_node(target_id)
                  {
                    deps_map.insert(dep.specifier.clone(), json!(target_asset.id));
                  }
                }
              }
            }
          }

          assets_code.push(format!(
            "\"{}\": [function(require,module,exports) {{\n{}\n}}, {}]",
            asset.id,
            code,
            serde_json::to_string(&deps_map)?
          ));
        }
      }
    }

    let assets_string = assets_code.join(",\n");
    let entry_ids_json = serde_json::to_string(&bundle.entry_asset_ids)?;
    let main_entry_id_json = serde_json::to_string(&bundle.main_entry_id)?;
    let parcel_require_name_json = json!("parcelRequire"); // Default

    let prelude = include_str!("../../../packages/packagers/js/src/dev-prelude.js");
    // Remove trailing semicolon if any to make it an expression if needed,
    // but it's an IIFE call: (function...) followed by call.
    // The file content starts with `(function...`.
    // We output: `(function...)({modules}, ...)`

    let output = format!(
      "{}({{ {} }}, {}, {}, {})",
      prelude.trim(),
      assets_string,
      entry_ids_json,
      main_entry_id_json,
      parcel_require_name_json
    );

    Ok(PackagedBundle {
      contents: output.into_bytes(),
    })
  }
}
