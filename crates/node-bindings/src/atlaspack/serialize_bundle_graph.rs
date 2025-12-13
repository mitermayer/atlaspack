use std::collections::HashMap;

use atlaspack_core::bundle_graph::{
  BundleGraph, BundleGraphEdgeType, BundleGraphNode, BundleGroup,
};
use atlaspack_core::types::{Asset, Bundle, Dependency};
use napi::{Env, JsObject};
use petgraph::visit::IntoEdgeReferences;
use rayon::iter::{IntoParallelRefIterator, ParallelIterator};
use serde::Serialize;

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum SerializedBundleGraphNode<'a> {
  Asset {
    value: &'a Asset,
  },
  Dependency {
    value: &'a Dependency,
  },
  Bundle {
    value: &'a Bundle,
  },
  #[serde(rename = "bundle_group")]
  BundleGroup {
    value: &'a BundleGroup,
  },
  Root {
    value: Option<()>,
  },
}

pub fn serialize_bundle_graph(env: &Env, bundle_graph: &BundleGraph) -> anyhow::Result<JsObject> {
  let mut js_result = env.create_object()?;

  let node_indices: Vec<_> = bundle_graph.graph.node_indices().collect();
  let index_map: HashMap<_, _> = node_indices
    .iter()
    .enumerate()
    .map(|(i, &idx)| (idx, i as u32))
    .collect();

  // Serialize nodes in parallel
  let nodes_data: Vec<Vec<u8>> = node_indices
    .par_iter()
    .map(|&idx| {
      let node = &bundle_graph.graph[idx];
      let serialized_node = match node {
        BundleGraphNode::Asset(asset) => SerializedBundleGraphNode::Asset { value: asset },
        BundleGraphNode::Dependency(dep) => SerializedBundleGraphNode::Dependency { value: dep },
        BundleGraphNode::Bundle(bundle) => SerializedBundleGraphNode::Bundle { value: bundle },
        BundleGraphNode::BundleGroup(group) => {
          SerializedBundleGraphNode::BundleGroup { value: group }
        }
        BundleGraphNode::Root => SerializedBundleGraphNode::Root { value: None },
      };
      serde_json::to_vec(&serialized_node)
    })
    .collect::<Result<Vec<_>, _>>()?;

  let mut js_nodes = env.create_array_with_length(nodes_data.len())?;
  for (i, node_bytes) in nodes_data.into_iter().enumerate() {
    let js_buffer = env.create_buffer_with_data(node_bytes)?;
    js_nodes.set_element(i as u32, js_buffer.into_unknown())?;
  }

  js_result.set_named_property("nodes", js_nodes)?;

  // Serialize edges
  // Expected format: [from, to, type, from, to, type, ...]
  let mut edges = Vec::new();
  for edge in bundle_graph.graph.edge_references() {
    let from = index_map[&edge.source()];
    let to = index_map[&edge.target()];
    let type_id = match edge.weight() {
      BundleGraphEdgeType::Null => 1,
      BundleGraphEdgeType::Contains => 2,
      BundleGraphEdgeType::Bundle => 3,
      BundleGraphEdgeType::References => 4,
      BundleGraphEdgeType::InternalAsync => 5,
      BundleGraphEdgeType::Conditional => 6, // Assuming 6 based on pattern, though JS file said 5
    };

    edges.push(from);
    edges.push(to);
    edges.push(type_id);
  }

  js_result.set_named_property("edges", edges)?;

  Ok(js_result)
}
