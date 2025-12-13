use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::Arc;

use anyhow::anyhow;
use async_trait::async_trait;
use atlaspack_core::asset_graph::{AssetGraph, AssetGraphNode};
use atlaspack_core::bundle_graph::{BundleGraph, BundleGraphEdgeType, BundleGraphNode};
use petgraph::visit::{EdgeRef, IntoEdgeReferences};
use serde::{Deserialize, Serialize};

use crate::bundler::DefaultBundler;
use crate::request_tracker::{Request, ResultAndInvalidations, RunRequestContext, RunRequestError};

use super::RequestResult;
use super::asset_graph_request::AssetGraphRequest;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct BundleGraphRequest {
  // TODO: Add fields
}

impl Hash for BundleGraphRequest {
  fn hash<H: Hasher>(&self, _state: &mut H) {}
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct BundleGraphRequestOutput {
  pub bundle_graph: Arc<BundleGraph>,
}

#[async_trait]
impl Request for BundleGraphRequest {
  async fn run(
    &self,
    mut request_context: RunRequestContext,
  ) -> Result<ResultAndInvalidations, RunRequestError> {
    let asset_graph_request = AssetGraphRequest::default();

    let (result, _id, _cached) = request_context.execute_request(asset_graph_request).await?;

    let asset_graph = match result.as_ref() {
      RequestResult::AssetGraph(output) => &output.graph,
      _ => return Err(anyhow!("Expected AssetGraph output")),
    };

    let mut bundle_graph = BundleGraph::new();
    populate_bundle_graph(asset_graph, &mut bundle_graph);

    DefaultBundler::bundle(&mut bundle_graph, asset_graph)?;

    Ok(ResultAndInvalidations {
      result: RequestResult::BundleGraph(BundleGraphRequestOutput {
        bundle_graph: Arc::new(bundle_graph),
      }),
      invalidations: vec![],
    })
  }
}

fn populate_bundle_graph(asset_graph: &AssetGraph, bundle_graph: &mut BundleGraph) {
  let mut id_map: HashMap<atlaspack_core::asset_graph::NodeId, petgraph::stable_graph::NodeIndex> =
    HashMap::new();

  // Add nodes
  for (node_id, node) in asset_graph.nodes().enumerate() {
    let bundle_graph_node = match node {
      AssetGraphNode::Asset(asset) => BundleGraphNode::Asset(asset.clone()),
      AssetGraphNode::Dependency(dep) => BundleGraphNode::Dependency(dep.clone()),
      AssetGraphNode::Root => BundleGraphNode::Root,
      _ => continue,
    };

    if matches!(bundle_graph_node, BundleGraphNode::Root) {
      if let Some(root_idx) = bundle_graph
        .graph
        .node_indices()
        .find(|idx| matches!(bundle_graph.graph[*idx], BundleGraphNode::Root))
      {
        id_map.insert(node_id, root_idx);
        continue;
      }
    }

    let idx = bundle_graph.graph.add_node(bundle_graph_node);
    id_map.insert(node_id, idx);
  }

  // Add edges
  for edge in asset_graph.graph.edge_references() {
    let source_node_index = edge.source();
    let target_node_index = edge.target();

    let source_node_id = *asset_graph.graph.node_weight(source_node_index).unwrap();
    let target_node_id = *asset_graph.graph.node_weight(target_node_index).unwrap();

    if let (Some(&source_idx), Some(&target_idx)) =
      (id_map.get(&source_node_id), id_map.get(&target_node_id))
    {
      bundle_graph
        .graph
        .add_edge(source_idx, target_idx, BundleGraphEdgeType::Null);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::requests::RequestResult;
  use crate::test_utils::{RequestTrackerTestOptions, request_tracker};
  use atlaspack_filesystem::FileSystem;

  #[tokio::test(flavor = "multi_thread")]
  async fn test_bundle_graph_request() {
    let mut tracker = request_tracker(RequestTrackerTestOptions::default());
    let request = BundleGraphRequest::default();
    let result = tracker
      .run_request(request)
      .await
      .expect("Failed to run request");

    if let RequestResult::BundleGraph(output) = result.as_ref() {
      assert!(output.bundle_graph.graph.node_count() > 0); // At least Root
    } else {
      panic!("Wrong result type");
    }
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn test_bundle_graph_request_with_entry() {
    #[cfg(not(target_os = "windows"))]
    let temporary_dir = std::path::PathBuf::from("/atlaspack_tests");
    #[cfg(target_os = "windows")]
    let temporary_dir = std::path::PathBuf::from("c:/windows/atlaspack_tests");

    let fs = atlaspack_filesystem::in_memory_file_system::InMemoryFileSystem::default();
    fs.create_directory(&temporary_dir).unwrap();
    fs.set_current_working_directory(&temporary_dir);
    fs.write_file(
      &temporary_dir.join("entry.js"),
      String::from("console.log('hello')"),
    );
    fs.write_file(&temporary_dir.join("package.json"), String::from("{}"));

    let mut tracker = request_tracker(RequestTrackerTestOptions {
      atlaspack_options: atlaspack_core::types::AtlaspackOptions {
        entries: vec![temporary_dir.join("entry.js").to_str().unwrap().to_string()],
        ..atlaspack_core::types::AtlaspackOptions::default()
      },
      fs: Arc::new(fs),
      project_root: temporary_dir.clone(),
      search_path: temporary_dir.clone(),
      ..RequestTrackerTestOptions::default()
    });

    let request = BundleGraphRequest::default();
    let result = tracker
      .run_request(request)
      .await
      .expect("Failed to run request");

    if let RequestResult::BundleGraph(output) = result.as_ref() {
      assert!(output.bundle_graph.graph.node_count() >= 3);

      // Check for Bundle node
      let has_bundle = output
        .bundle_graph
        .graph
        .node_weights()
        .any(|node| matches!(node, BundleGraphNode::Bundle(_)));
      assert!(has_bundle, "BundleGraph should contain a Bundle node");

      // Check for BundleGroup node
      let has_bundle_group = output
        .bundle_graph
        .graph
        .node_weights()
        .any(|node| matches!(node, BundleGraphNode::BundleGroup(_)));
      assert!(
        has_bundle_group,
        "BundleGraph should contain a BundleGroup node"
      );
    } else {
      panic!("Wrong result type");
    }
  }
}
