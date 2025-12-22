use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};

use atlaspack_core::asset_graph::{AssetGraph, AssetGraphNode, NodeId};
use atlaspack_core::bundle_graph::BundleGraphEdgeType;
use atlaspack_core::types::{AtlaspackOptions, Bundle, BundleBehavior, Priority};
use fixedbitset::FixedBitSet;
use petgraph::graph::NodeIndex;
use petgraph::stable_graph::StableDiGraph;
use petgraph::visit::{EdgeRef, IntoEdgeReferences};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BundleRootEdge {
  Parallel,
  Lazy,
}

#[allow(dead_code)]
pub struct IdealGraph {
  pub bundle_root_graph: StableDiGraph<usize, BundleRootEdge>,
  pub reachable_roots: Vec<FixedBitSet>,
  pub reachable_assets: Vec<FixedBitSet>,
  pub ancestor_assets: Vec<Option<FixedBitSet>>,
  pub assets: Vec<NodeId>,
  pub bundle_graph: StableDiGraph<Bundle, BundleGraphEdgeType>,
  pub bundles: HashMap<String, NodeIndex>,
  pub asset_to_bundles: Vec<Vec<NodeIndex>>,
}

pub fn create_ideal_graph(asset_graph: &AssetGraph, _options: &AtlaspackOptions) -> IdealGraph {
  let mut assets = Vec::new();
  let mut asset_to_index = HashMap::new();

  // 1. Flatten asset_graph nodes into assets vector and map AssetId -> index
  for (node_id, node) in asset_graph.nodes().enumerate() {
    if let AssetGraphNode::Asset(_) = node {
      asset_to_index.insert(node_id, assets.len());
      assets.push(node_id);
    }
  }

  let mut reachable_roots = vec![FixedBitSet::with_capacity(assets.len()); assets.len()];
  let mut bundle_root_graph = StableDiGraph::new();
  let mut bundle_roots = HashMap::new(); // Map asset_index (usize) -> bundle_root_graph NodeIndex
  let mut entry_roots = HashSet::new();

  // 2. Identify Entry Assets and start traversal
  let root_node_id = asset_graph.root_node();
  let mut stack = Vec::new();

  let entry_deps = asset_graph.get_outgoing_neighbors(&root_node_id);

  for dep_node_id in entry_deps {
    if let Some(AssetGraphNode::Dependency(dep)) = asset_graph.get_node(&dep_node_id) {
      if !dep.is_entry {
        continue;
      }
      let targets = asset_graph.get_outgoing_neighbors(&dep_node_id);
      for asset_node_id in targets {
        if let Some(asset_idx) = asset_to_index.get(&asset_node_id) {
          let root_idx = *bundle_roots.entry(*asset_idx).or_insert_with(|| {
            let idx = bundle_root_graph.add_node(*asset_idx);
            entry_roots.insert(idx);
            idx
          });

          stack.push((asset_node_id, root_idx));
        }
      }
    }
  }

  let mut visited = HashSet::new();

  while let Some((node_id, bundle_root_idx)) = stack.pop() {
    if !visited.insert((node_id, bundle_root_idx)) {
      continue;
    }

    let node = asset_graph.get_node(&node_id);

    match node {
      Some(AssetGraphNode::Asset(asset)) => {
        if let Some(&asset_idx) = asset_to_index.get(&node_id) {
          if reachable_roots[asset_idx].len() <= bundle_root_idx.index() {
            reachable_roots[asset_idx].grow(bundle_root_idx.index() + 1);
          }
          reachable_roots[asset_idx].insert(bundle_root_idx.index());

          let skip_children = match asset.bundle_behavior {
            Some(BundleBehavior::Isolated) | Some(BundleBehavior::Inline) => true,
            _ => false,
          };

          if !skip_children {
            let neighbors = asset_graph.get_outgoing_neighbors(&node_id);
            for neighbor in neighbors {
              stack.push((neighbor, bundle_root_idx));
            }
          }
        }
      }
      Some(AssetGraphNode::Dependency(dep)) => {
        let priority = dep.priority;
        let targets = asset_graph.get_outgoing_neighbors(&node_id);

        if priority == Priority::Sync {
          for target in targets {
            stack.push((target, bundle_root_idx));
          }
        } else {
          // Start new bundle root
          for target in targets {
            if let Some(target_asset_idx) = asset_to_index.get(&target) {
              let new_root_idx = *bundle_roots
                .entry(*target_asset_idx)
                .or_insert_with(|| bundle_root_graph.add_node(*target_asset_idx));

              let edge_weight = match priority {
                Priority::Lazy => BundleRootEdge::Lazy,
                _ => BundleRootEdge::Parallel,
              };

              if bundle_root_graph
                .find_edge(bundle_root_idx, new_root_idx)
                .is_none()
              {
                bundle_root_graph.add_edge(bundle_root_idx, new_root_idx, edge_weight);
              }

              stack.push((target, new_root_idx));
            }
          }
        }
      }
      _ => {
        // ...
      }
    }
  }

  // 3. Compute reachable_assets (Inverse of reachable_roots)
  let mut reachable_assets =
    vec![FixedBitSet::with_capacity(assets.len()); bundle_root_graph.node_count()];
  for (asset_idx, roots) in reachable_roots.iter().enumerate() {
    for root_idx in roots.ones() {
      if root_idx < reachable_assets.len() {
        reachable_assets[root_idx].insert(asset_idx);
      }
    }
  }

  // 4. Availability Propagation
  let mut ancestor_assets: Vec<Option<FixedBitSet>> = vec![None; bundle_root_graph.node_count()];

  for &entry_root in &entry_roots {
    ancestor_assets[entry_root.index()] = Some(FixedBitSet::with_capacity(assets.len()));
  }

  let sorted_nodes = petgraph::algo::toposort(&bundle_root_graph, None).unwrap_or_else(|err| {
    panic!("Cycle detected in bundle root graph: {:?}", err);
  });

  for node_idx in sorted_nodes {
    let mut available = if let Some(a) = &ancestor_assets[node_idx.index()] {
      a.clone()
    } else {
      continue;
    };

    let root_asset_idx = bundle_root_graph[node_idx];
    available.insert(root_asset_idx);
    available.union_with(&reachable_assets[node_idx.index()]);

    let mut parallel_availability = FixedBitSet::with_capacity(assets.len());

    let mut edges: Vec<_> = bundle_root_graph.edges(node_idx).collect();
    edges.reverse();

    for edge in edges {
      let child_idx = edge.target();
      let edge_type = edge.weight();
      let is_parallel = *edge_type == BundleRootEdge::Parallel;

      let current_child_available = if is_parallel {
        let mut tmp = available.clone();
        tmp.union_with(&parallel_availability);
        tmp
      } else {
        available.clone()
      };

      if let Some(child_available) = &mut ancestor_assets[child_idx.index()] {
        child_available.intersect_with(&current_child_available);
      } else {
        ancestor_assets[child_idx.index()] = Some(current_child_available);
      }

      if is_parallel {
        let child_root_asset_idx = bundle_root_graph[child_idx];
        parallel_availability.union_with(&reachable_assets[child_idx.index()]);
        parallel_availability.insert(child_root_asset_idx);
      }
    }
  }

  // 5. Insert or Share
  let mut bundle_graph = StableDiGraph::new();
  let mut bundles = HashMap::new();
  let mut root_to_bundle_node = HashMap::new();

  for root_node_idx in bundle_root_graph.node_indices() {
    let asset_idx = bundle_root_graph[root_node_idx];
    let asset_node_id = assets[asset_idx];
    let asset = match asset_graph.get_node(&asset_node_id) {
      Some(AssetGraphNode::Asset(a)) => a,
      _ => continue,
    };

    let mut target = atlaspack_core::types::Target::default();
    for neighbor in asset_graph.get_incoming_neighbors(&asset_node_id) {
      if let Some(AssetGraphNode::Dependency(dep)) = asset_graph.get_node(&neighbor) {
        if let Some(t) = &dep.target {
          target = *t.clone();
          break;
        }
      }
    }

    let bundle_id = asset.id.clone().to_string();
    let bundle = Bundle {
      id: bundle_id.clone(),
      bundle_behavior: asset.bundle_behavior,
      bundle_type: asset.file_type.clone(),
      entry_asset_ids: vec![asset.id.clone().to_string()],
      env: (*asset.env).clone(),
      hash_reference: format!("hash_{}", bundle_id),
      is_splittable: true,
      main_entry_id: Some(asset.id.clone().to_string()),
      manual_shared_bundle: None,
      name: None,
      needs_stable_name: false,
      pipeline: asset.pipeline.clone(),
      public_id: None,
      target,
    };

    let node_idx = bundle_graph.add_node(bundle);
    bundles.insert(bundle_id, node_idx);
    root_to_bundle_node.insert(root_node_idx, node_idx);
  }

  for edge in bundle_root_graph.edge_references() {
    let source = root_to_bundle_node[&edge.source()];
    let target = root_to_bundle_node[&edge.target()];
    let weight = match edge.weight() {
      BundleRootEdge::Parallel => BundleGraphEdgeType::References,
      BundleRootEdge::Lazy => BundleGraphEdgeType::InternalAsync,
    };
    bundle_graph.add_edge(source, target, weight);
  }

  let mut asset_to_bundles: Vec<Vec<NodeIndex>> = vec![Vec::new(); assets.len()];
  let mut shared_bundles: HashMap<Vec<NodeIndex>, NodeIndex> = HashMap::new();

  for (asset_idx, asset_node_id) in assets.iter().enumerate() {
    let asset = match asset_graph.get_node(asset_node_id) {
      Some(AssetGraphNode::Asset(a)) => a,
      _ => continue,
    };

    let roots = &reachable_roots[asset_idx];
    let mut reachable_bundles = Vec::new();

    for root_idx in roots.ones() {
      let is_available = if let Some(avail) = &ancestor_assets[root_idx] {
        avail.contains(asset_idx)
      } else {
        false
      };

      if !is_available {
        reachable_bundles.push(root_idx);
      }
    }

    if reachable_bundles.is_empty() {
      continue;
    }

    let can_share = true; // TODO: Check options/config

    if reachable_bundles.len() > 1 && can_share {
      let mut source_bundle_nodes = Vec::with_capacity(reachable_bundles.len());
      for &root_idx in &reachable_bundles {
        if let Some(&node_idx) = root_to_bundle_node.get(&NodeIndex::new(root_idx)) {
          source_bundle_nodes.push(node_idx);
        }
      }
      source_bundle_nodes.sort();

      let shared_bundle_node = if let Some(&node) = shared_bundles.get(&source_bundle_nodes) {
        node
      } else {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        source_bundle_nodes.hash(&mut hasher);
        let hash = hasher.finish();
        let bundle_id = format!("shared_{}", hash);

        let first_source = bundle_graph[source_bundle_nodes[0]].clone();

        let bundle = Bundle {
          id: bundle_id.clone(),
          bundle_behavior: None,
          bundle_type: asset.file_type.clone(),
          entry_asset_ids: Vec::new(),
          env: first_source.env,
          hash_reference: format!("hash_{}", bundle_id),
          is_splittable: true,
          main_entry_id: None,
          manual_shared_bundle: None,
          name: None,
          needs_stable_name: true,
          pipeline: first_source.pipeline,
          public_id: None,
          target: first_source.target,
        };

        let node_idx = bundle_graph.add_node(bundle);
        bundles.insert(bundle_id, node_idx);
        shared_bundles.insert(source_bundle_nodes.clone(), node_idx);

        for &source_idx in &source_bundle_nodes {
          if bundle_graph.find_edge(source_idx, node_idx).is_none() {
            bundle_graph.add_edge(source_idx, node_idx, BundleGraphEdgeType::References);
          }
        }
        node_idx
      };

      asset_to_bundles[asset_idx].push(shared_bundle_node);
    } else {
      for root_idx in reachable_bundles {
        if let Some(&node_idx) = root_to_bundle_node.get(&NodeIndex::new(root_idx)) {
          asset_to_bundles[asset_idx].push(node_idx);
        }
      }
    }
  }

  IdealGraph {
    bundle_root_graph,
    reachable_roots,
    reachable_assets,
    ancestor_assets,
    assets,
    bundle_graph,
    bundles,
    asset_to_bundles,
  }
}
