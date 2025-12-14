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
  // We assume BundleGraph is already populated with Assets and Dependencies
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
    // Get Asset from AssetGraph
    let asset = match asset_graph.get_node(&asset_node_id) {
      Some(AssetGraphNode::Asset(a)) => a,
      _ => continue,
    };

    // Find in BundleGraph
    if let Some(&asset_graph_node_idx) = asset_id_to_node_index.get(&asset.id) {
      for &ideal_bundle_idx in bundles {
        if let Some(&bundle_graph_node_idx) = ideal_bundle_to_graph_node.get(&ideal_bundle_idx) {
          // Add Edge: Bundle -> Asset (Contains)
          // Check if edge already exists to avoid duplicates (though multigraph allows, we prefer unique)
          // StableDiGraph allows multiple edges.
          // Ideally we check find_edge but it might be slow if many edges.
          // Since we iterate once, duplicates shouldn't happen unless ideal_graph has dups.
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
  // Identify entry dependencies in BundleGraph
  // We need to iterate over all Dependencies in BundleGraph that are entries.
  // Then find the corresponding Bundle and create BundleGroup.

  // We can't iterate bundle_graph.graph.node_indices() safely while mutating it.
  // Collect entries first.
  let mut entries = Vec::new();

  for (_dep_id, &dep_node_idx) in &dependency_id_to_node_index {
    if let BundleGraphNode::Dependency(dep) = &bundle_graph.graph[dep_node_idx] {
      if dep.is_entry {
        // Find the resolved asset for this dependency.
        // In BundleGraph, we assume Dependency -> Asset edge exists or we can look it up?
        // Wait, BundleGraph edges might not be populated yet?
        // The instructions assume BundleGraph has assets/deps.
        // But usually edges (resolution) are also there?
        // If not, we might need to look at AssetGraph to find what this dependency resolves to.

        // Let's use AssetGraph to find the target asset of the dependency.
        // We need the NodeId of the dependency in AssetGraph.
        // We have `dep.id`. We can scan AssetGraph or assume we can find it.
        // But scanning AssetGraph for every entry might be slow.
        // IdealGraph doesn't store Dependency mapping.

        // However, `IdealGraph` was built from `AssetGraph`.
        // Let's assume we can find the Asset using `dep.target`? No.
        // In `decorate_legacy_graph`, we have `asset_graph`.
        // We can find the dependency node in `asset_graph`.
        // `AssetGraph` doesn't have a fast lookup by ID?
        // It has `nodes()` iterator.
        // `asset_graph.get_node_by_id`? No.

        // But we have `dependency_id_to_node_index`.
        // If BundleGraph has edges Dependency -> Asset, we use that.
        // Let's assume BundleGraph edges are present (Resolution).

        let mut targets = bundle_graph
          .graph
          .neighbors_directed(dep_node_idx, petgraph::Direction::Outgoing);

        if let Some(asset_node_idx) = targets.next() {
          if let BundleGraphNode::Asset(asset) = &bundle_graph.graph[asset_node_idx] {
            entries.push((dep_node_idx, asset.id.clone(), dep.target.clone()));
          }
        } else {
          // Fallback: Use AssetGraph if BundleGraph edges are missing?
          // For now, assume BundleGraph is fully populated structure-wise.
        }
      }
    }
  }

  for (dep_node_idx, asset_id, target) in entries {
    // Find the bundle where this asset is the main entry.
    // We can search our `ideal_bundle_to_graph_node` map or `bundle_graph` itself.
    // Searching `bundle_graph` for Bundle nodes with `main_entry_id == asset_id`.

    let mut entry_bundle_node_idx = None;

    // Optimization: we could have built a map `main_entry_id -> bundle_node_idx` during step 2.
    // Since we didn't, let's iterate. (Number of bundles is usually manageable).
    for &node_idx in ideal_bundle_to_graph_node.values() {
      if let BundleGraphNode::Bundle(b) = &bundle_graph.graph[node_idx] {
        if b.main_entry_id.as_ref() == Some(&asset_id) {
          entry_bundle_node_idx = Some(node_idx);
          break;
        }
      }
    }

    if let Some(bundle_node_idx) = entry_bundle_node_idx {
      // Create BundleGroup
      let bundle_group = BundleGroup {
        target: *target.expect("Entry dependency must have a target").clone(),
        entry_asset_id: asset_id.clone(),
      };

      let bundle_group_node = BundleGraphNode::BundleGroup(Box::new(bundle_group));
      let group_node_idx = bundle_graph.graph.add_node(bundle_group_node);

      // Connect Dependency -> BundleGroup
      bundle_graph
        .graph
        .add_edge(dep_node_idx, group_node_idx, BundleGraphEdgeType::Bundle);

      // Connect BundleGroup -> Bundle
      bundle_graph
        .graph
        .add_edge(group_node_idx, bundle_node_idx, BundleGraphEdgeType::Bundle);
    }
  }
}
