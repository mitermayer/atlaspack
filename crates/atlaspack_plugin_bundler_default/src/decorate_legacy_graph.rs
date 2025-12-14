use std::collections::HashMap;

use atlaspack_core::asset_graph::{AssetGraph, AssetGraphNode};
use atlaspack_core::bundle_graph::{
  BundleGraph, BundleGraphEdgeType, BundleGraphNode, BundleGroup,
};
use petgraph::visit::{EdgeRef, IntoEdgeReferences};

use super::ideal_graph::IdealGraph;

pub fn decorate_legacy_graph(
  ideal_graph: &IdealGraph,
  asset_graph: &AssetGraph,
  bundle_graph: &mut BundleGraph,
) {
  // 1. Build map: AssetId (String) -> BundleGraph NodeIndex
  let mut asset_id_to_node_index = HashMap::new();
  let mut dependency_id_to_node_index = HashMap::new();

  for node_idx in bundle_graph.graph.node_indices() {
    match &bundle_graph.graph[node_idx] {
      BundleGraphNode::Asset(a) => {
        asset_id_to_node_index.insert(a.id.clone(), node_idx);
      }
      BundleGraphNode::Dependency(d) => {
        dependency_id_to_node_index.insert(d.id.clone(), node_idx);
      }
      _ => {}
    }
  }

  // 2. Add Bundles
  let mut ideal_bundle_to_graph_node = HashMap::new();

  for ideal_bundle_idx in ideal_graph.bundle_graph.node_indices() {
    let bundle = ideal_graph.bundle_graph[ideal_bundle_idx].clone();
    let bundle_node = BundleGraphNode::Bundle(Box::new(bundle));
    let node_idx = bundle_graph.graph.add_node(bundle_node);
    ideal_bundle_to_graph_node.insert(ideal_bundle_idx, node_idx);
  }

  // 3. Add Assets to Bundles (Edges)
  for (asset_idx, bundles) in ideal_graph.asset_to_bundles.iter().enumerate() {
    let asset_node_id = ideal_graph.assets[asset_idx];
    let asset = match asset_graph.get_node(&asset_node_id) {
      Some(AssetGraphNode::Asset(a)) => a,
      _ => continue,
    };

    if let Some(&asset_graph_node_idx) = asset_id_to_node_index.get(&asset.id) {
      for &ideal_bundle_idx in bundles {
        if let Some(&bundle_graph_node_idx) = ideal_bundle_to_graph_node.get(&ideal_bundle_idx) {
          bundle_graph.graph.add_edge(
            bundle_graph_node_idx,
            asset_graph_node_idx,
            BundleGraphEdgeType::Contains,
          );
        }
      }
    }
  }

  // 4. Edges between Bundles
  for edge in ideal_graph.bundle_graph.edge_references() {
    let source = edge.source();
    let target = edge.target();
    let weight = *edge.weight();

    if let (Some(&source_node), Some(&target_node)) = (
      ideal_bundle_to_graph_node.get(&source),
      ideal_bundle_to_graph_node.get(&target),
    ) {
      bundle_graph
        .graph
        .add_edge(source_node, target_node, weight);
    }
  }

  // 5. Bundle Groups (Entries)
  let mut entries = Vec::new();

  for (_dep_id, &dep_node_idx) in &dependency_id_to_node_index {
    if let BundleGraphNode::Dependency(dep) = &bundle_graph.graph[dep_node_idx] {
      if dep.is_entry {
        let mut targets = bundle_graph
          .graph
          .neighbors_directed(dep_node_idx, petgraph::Direction::Outgoing);

        if let Some(asset_node_idx) = targets.next() {
          if let BundleGraphNode::Asset(asset) = &bundle_graph.graph[asset_node_idx] {
            entries.push((dep_node_idx, asset.id.clone(), dep.target.clone()));
          }
        }
      }
    }
  }

  for (dep_node_idx, asset_id, target) in entries {
    let mut entry_bundle_node_idx = None;

    for &node_idx in ideal_bundle_to_graph_node.values() {
      if let BundleGraphNode::Bundle(b) = &bundle_graph.graph[node_idx] {
        if b.main_entry_id.as_ref() == Some(&asset_id) {
          entry_bundle_node_idx = Some(node_idx);
          break;
        }
      }
    }

    if let Some(bundle_node_idx) = entry_bundle_node_idx {
      let bundle_group = BundleGroup {
        target: *target.expect("Entry dependency must have a target").clone(),
        entry_asset_id: asset_id.clone(),
      };

      let bundle_group_node = BundleGraphNode::BundleGroup(Box::new(bundle_group));
      let group_node_idx = bundle_graph.graph.add_node(bundle_group_node);

      bundle_graph
        .graph
        .add_edge(dep_node_idx, group_node_idx, BundleGraphEdgeType::Bundle);

      bundle_graph
        .graph
        .add_edge(group_node_idx, bundle_node_idx, BundleGraphEdgeType::Bundle);
    }
  }
}
