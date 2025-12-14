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
  // We need to find dependencies that are entries.
  // Since AssetGraph doesn't efficiently expose "all entry dependencies", we iterate all nodes.
  // Or we can start from root -> entry dependencies.
  // AssetGraph has a root node (id 0). Entry dependencies are usually children of root.

  // Let's assume standard AssetGraph structure: Root -> Dependency(Entry) -> Asset

  let root_node_id = asset_graph.root_node();
  let mut stack = Vec::new();

  // Find entry dependencies from the root
  // Usually entry dependencies are attached to the root node?
  // Let's look at `should_request_entry_asset` test in asset_graph.rs.
  // `graph.add_entry_dependency` adds a dependency. `add_edge(root, dep)`.
  // So neighbors of root are entry dependencies.

  let entry_deps = asset_graph.get_outgoing_neighbors(&root_node_id);

  for dep_node_id in entry_deps {
    if let Some(AssetGraphNode::Dependency(dep)) = asset_graph.get_node(&dep_node_id) {
      if !dep.is_entry {
        continue;
      }
      // Traverse from this dependency
      // The target of this dependency is the entry asset
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

  // Also iterate all nodes to find any other entries if the graph structure is different?
  // The prompt says: "Iterate asset_graph to find entries (dependencies where is_entry is true)."
  // Let's stick to neighbors of root for now, or iterate all if needed.
  // Usually entry deps are connected to root. But checking `is_entry` on all deps is safer if we are unsure of graph structure.
  // However, AssetGraph structure implies reachability from Root.

  let mut visited = HashSet::new();

  while let Some((node_id, bundle_root_idx)) = stack.pop() {
    if !visited.insert((node_id, bundle_root_idx)) {
      continue;
    }

    let node = asset_graph.get_node(&node_id);

    match node {
      Some(AssetGraphNode::Asset(asset)) => {
        if let Some(&asset_idx) = asset_to_index.get(&node_id) {
          // Mark as reachable from the current bundle root
          // The bundle_root_idx in the graph points to an asset index.
          // We need the index of that bundle root in the `bundle_root_graph`.
          // Wait, `bundle_root_idx` IS the NodeIndex in `bundle_root_graph`.

          // But `reachable_roots` stores which *bundle roots* are reachable.
          // The prompt says: "reachable_roots: Vec<FixedBitSet>. Index matches assets vector."
          // Each bitset should represent which bundle roots reach this asset.
          // So we need to map `bundle_root_idx` (NodeIndex) to... something?
          // Usually bitset indices correspond to the index of the bundle root in `bundle_root_graph`?
          // Or maybe it corresponds to the index in `assets` of the bundle root?
          // "Construct bundle_root_graph ... Nodes are indices into an assets vector."

          // If `reachable_roots` uses FixedBitSet, we need an integer ID for each bundle root.
          // `bundle_root_graph.node_count()` can be used if we don't delete nodes.
          // So `bundle_root_idx.index()` is fine.

          // Resize bitset if needed? No, bitset size is `bundle_root_graph` size?
          // No, usually "reachable_roots" tracks *which* bundles contain this asset.
          // If we use NodeIndex from bundle_root_graph, we need to ensure the bitset is large enough.
          // But we don't know the number of bundles upfront.

          // Maybe `reachable_roots` stores the `asset_index` of the roots?
          // "Compute reachable_roots: Vec<FixedBitSet>. Index matches assets vector."
          // The content of FixedBitSet usually refers to `bundle_id` or similar.
          // Let's assume we use `bundle_root_graph` NodeIndex as the ID.

          if reachable_roots[asset_idx].len() <= bundle_root_idx.index() {
            reachable_roots[asset_idx].grow(bundle_root_idx.index() + 1);
          }
          reachable_roots[asset_idx].insert(bundle_root_idx.index());

          // Bundle Behavior Check
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

              // Add edge if not exists
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

  // Initialize entry roots with empty availability
  for &entry_root in &entry_roots {
    ancestor_assets[entry_root.index()] = Some(FixedBitSet::with_capacity(assets.len()));
  }

  // Topological sort
  let sorted_nodes = petgraph::algo::toposort(&bundle_root_graph, None).unwrap_or_else(|err| {
    // If there is a cycle, we just return what we have (or handle it gracefully).
    // For now, let's use the partial result or node id from error?
    // petgraph returns Cycle<NodeId>.
    // Since we must return something valid, we might need to handle cycles.
    // However, bundle graph usually shouldn't have cycles in a valid build?
    // Async cycles are possible but they are edges.
    // Ideally we should break cycles or ignore back edges.
    // For this implementation, let's panic or handle?
    // Let's assume DAG for now as per "IdealGraph".
    panic!("Cycle detected in bundle root graph: {:?}", err);
  });

  for node_idx in sorted_nodes {
    let mut available = if let Some(a) = &ancestor_assets[node_idx.index()] {
      a.clone()
    } else {
      // Unreachable or not yet visited (should not happen for entries/connected nodes)
      continue;
    };

    // Add assets from current bundle (root + reachable)
    let root_asset_idx = bundle_root_graph[node_idx];
    available.insert(root_asset_idx);
    available.union_with(&reachable_assets[node_idx.index()]);

    let mut parallel_availability = FixedBitSet::with_capacity(assets.len());

    // Iterate children (outgoing edges)
    // We need to iterate in order to correctly accumulate parallel availability
    // StableDiGraph edges walker might not be in insertion order?
    // But usually it is.
    let mut edges: Vec<_> = bundle_root_graph.edges(node_idx).collect();
    // We might want to sort edges if needed, but for now rely on insertion order.
    // Edges are usually iterated in reverse insertion order in petgraph?
    // Actually, `edges` walker order is implementation detail.
    // Let's reverse if petgraph walks in reverse.
    // "The order of edges is not specified" in docs, but often LIFO or FIFO depending on backend.
    // StableGraph uses a list. `next_edge` points to previous. So it's LIFO (reverse insertion).
    // We should reverse it to get insertion order.
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

  // Create bundles for each root in bundle_root_graph
  for root_node_idx in bundle_root_graph.node_indices() {
    let asset_idx = bundle_root_graph[root_node_idx];
    let asset_node_id = assets[asset_idx];
    let asset = match asset_graph.get_node(&asset_node_id) {
      Some(AssetGraphNode::Asset(a)) => a,
      _ => continue,
    };

    // Attempt to find target from incoming dependencies
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
      hash_reference: format!("hash_{}", bundle_id), // Placeholder
      is_splittable: true,                           // TODO: check bundle behavior/config
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

  // Add edges from bundle_root_graph
  for edge in bundle_root_graph.edge_references() {
    let source = root_to_bundle_node[&edge.source()];
    let target = root_to_bundle_node[&edge.target()];
    let weight = match edge.weight() {
      BundleRootEdge::Parallel => BundleGraphEdgeType::References, // Or Bundle?
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

    // Calculate reachable bundles
    let roots = &reachable_roots[asset_idx];
    let mut reachable_bundles = Vec::new();

    for root_idx in roots.ones() {
      // Check if asset is already available in ancestors of this root
      // We need to check if ANY ancestor of root_idx provides this asset.
      // ancestor_assets[root_idx] contains assets available from ancestors.
      let is_available = if let Some(avail) = &ancestor_assets[root_idx] {
        avail.contains(asset_idx)
      } else {
        false
      };

      if !is_available {
        // Also check if this bundle (root) allows splitting/sharing if it was a real bundle check
        // For now, we assume all roots are candidates unless filtered
        reachable_bundles.push(root_idx);
      }
    }

    if reachable_bundles.is_empty() {
      continue;
    }

    // Insert or Share
    // If > 1 reachable bundle, and config allows, create shared bundle
    let can_share = true; // TODO: Check options/config (disableSharedBundles)

    if reachable_bundles.len() > 1 && can_share {
      // Create Shared Bundle Key (sorted root indices)
      // We map root indices to BundleGraph NodeIndices for the key?
      // Or keep using root indices for the key?
      // Since shared_bundles maps to BundleGraph NodeIndex, using root indices as key is fine if stable.
      // reachable_bundles is already sorted (roots.ones() returns sorted).

      let mut source_bundle_nodes = Vec::with_capacity(reachable_bundles.len());
      for &root_idx in &reachable_bundles {
        if let Some(&node_idx) = root_to_bundle_node.get(&NodeIndex::new(root_idx)) {
          source_bundle_nodes.push(node_idx);
        }
      }
      // Sort source_bundle_nodes to be sure (though reachable_bundles was sorted)
      source_bundle_nodes.sort();

      let shared_bundle_node = if let Some(&node) = shared_bundles.get(&source_bundle_nodes) {
        node
      } else {
        // Create new Shared Bundle
        // Use hash of source IDs for ID
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        source_bundle_nodes.hash(&mut hasher);
        let hash = hasher.finish();
        let bundle_id = format!("shared_{}", hash);

        // For shared bundle, we need to pick an environment/target.
        // Usually matches one of the sources or lowest common denominator.
        // Let's pick from first source.
        let first_source = bundle_graph[source_bundle_nodes[0]].clone();

        let bundle = Bundle {
          id: bundle_id.clone(),
          bundle_behavior: None, // Shared
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

        // Add edges from sources to shared bundle
        for &source_idx in &source_bundle_nodes {
          // Check if edge exists?
          // StableDiGraph allows multiple edges. We should avoid duplicates.
          // Or just add.
          if bundle_graph.find_edge(source_idx, node_idx).is_none() {
            bundle_graph.add_edge(source_idx, node_idx, BundleGraphEdgeType::References);
          }
        }
        node_idx
      };

      asset_to_bundles[asset_idx].push(shared_bundle_node);
    } else {
      // Add to all reachable bundles (duplication)
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

#[cfg(test)]
mod tests {
  use super::*;
  use atlaspack_core::types::{
    Asset, Dependency, DependencyBuilder, Environment, Priority, SpecifierType, Target,
  };
  use std::path::PathBuf;
  use std::sync::Arc;

  fn create_asset(path: &str) -> Asset {
    Asset::new(
      atlaspack_core::types::Code::from(""),
      false,
      Arc::new(Environment::default()),
      PathBuf::from(path),
      None,
      &PathBuf::from("/"),
      None,
      false,
    )
    .unwrap()
  }

  #[test]
  fn test_reachability_analysis() {
    let mut asset_graph = AssetGraph::new();

    // 1. Entry -> A
    let target = Target::default();
    let entry_dep = Dependency::entry("entry.js".to_string(), target);
    let entry_dep_node_id = asset_graph.add_entry_dependency(entry_dep, false);
    asset_graph.add_edge(&asset_graph.root_node(), &entry_dep_node_id);

    let asset_a = create_asset("entry.js");
    let asset_a_node_id = asset_graph.add_asset(Arc::new(asset_a), false);
    asset_graph.add_edge(&entry_dep_node_id, &asset_a_node_id);

    // 2. A -> Async(B)
    let dep_a_b = DependencyBuilder::default()
      .specifier("b.js".to_string())
      .priority(Priority::Lazy)
      .env(Arc::new(Environment::default()))
      .specifier_type(SpecifierType::Esm)
      .build();
    let dep_a_b_node_id = asset_graph.add_dependency(dep_a_b, false);
    asset_graph.add_edge(&asset_a_node_id, &dep_a_b_node_id);

    let asset_b = create_asset("b.js");
    let asset_b_node_id = asset_graph.add_asset(Arc::new(asset_b), false);
    asset_graph.add_edge(&dep_a_b_node_id, &asset_b_node_id);

    // 3. Run Reachability
    let options = AtlaspackOptions::default();
    let ideal_graph = create_ideal_graph(&asset_graph, &options);

    // 4. Assertions
    assert_eq!(ideal_graph.assets.len(), 2);

    let asset_a_idx = ideal_graph
      .assets
      .iter()
      .position(|&id| id == asset_a_node_id)
      .unwrap();
    let asset_b_idx = ideal_graph
      .assets
      .iter()
      .position(|&id| id == asset_b_node_id)
      .unwrap();

    // Verify Bundle Root Graph
    // Should have 2 nodes: A (entry) and B (async)
    assert_eq!(ideal_graph.bundle_root_graph.node_count(), 2);

    // Find roots corresponding to assets
    let root_a = ideal_graph
      .bundle_root_graph
      .node_indices()
      .find(|&idx| ideal_graph.bundle_root_graph[idx] == asset_a_idx)
      .expect("Root A not found");
    let root_b = ideal_graph
      .bundle_root_graph
      .node_indices()
      .find(|&idx| ideal_graph.bundle_root_graph[idx] == asset_b_idx)
      .expect("Root B not found");

    // Edge A -> B
    assert!(
      ideal_graph
        .bundle_root_graph
        .find_edge(root_a, root_b)
        .is_some()
    );

    // Verify Reachability
    // A should be reachable from Root A
    assert!(ideal_graph.reachable_roots[asset_a_idx].contains(root_a.index()));
    assert!(!ideal_graph.reachable_roots[asset_a_idx].contains(root_b.index()));

    // B should be reachable from Root B
    assert!(ideal_graph.reachable_roots[asset_b_idx].contains(root_b.index()));
    // B is NOT reachable from Root A in terms of "bundling reachability" because the async edge breaks the bundle.
    assert!(!ideal_graph.reachable_roots[asset_b_idx].contains(root_a.index()));

    // Verify Reachable Assets (Inverse)
    assert!(ideal_graph.reachable_assets[root_a.index()].contains(asset_a_idx));
    assert!(!ideal_graph.reachable_assets[root_a.index()].contains(asset_b_idx));
    assert!(ideal_graph.reachable_assets[root_b.index()].contains(asset_b_idx));

    // Verify Availability
    // Root A is entry, so available should be empty (or None if implementation detail, but we return Vec<Option>)
    // Wait, implementation: entries initialized to Some(empty).
    let avail_a = ideal_graph.ancestor_assets[root_a.index()]
      .as_ref()
      .unwrap();
    assert_eq!(avail_a.count_ones(..), 0); // No ancestors

    // Root B (Async child of A)
    // Should have A available (since A is in bundle A).
    let avail_b = ideal_graph.ancestor_assets[root_b.index()]
      .as_ref()
      .unwrap();
    assert!(avail_b.contains(asset_a_idx));
    // Should NOT contain B itself (ancestor assets doesn't include self unless loop)
    assert!(!avail_b.contains(asset_b_idx));
  }

  #[test]
  fn test_shared_bundles() {
    let mut asset_graph = AssetGraph::new();
    let target = Target::default();

    // Entry -> A
    let entry_dep = Dependency::entry("entry.js".to_string(), target);
    let entry_dep_node_id = asset_graph.add_entry_dependency(entry_dep, false);
    asset_graph.add_edge(&asset_graph.root_node(), &entry_dep_node_id);

    let asset_a = create_asset("entry.js");
    let asset_a_id = asset_a.id.clone();
    let asset_a_node_id = asset_graph.add_asset(Arc::new(asset_a), false);
    asset_graph.add_edge(&entry_dep_node_id, &asset_a_node_id);

    // A -> Async(B)
    let dep_a_b = DependencyBuilder::default()
      .specifier("b.js".to_string())
      .priority(Priority::Lazy)
      .env(Arc::new(Environment::default()))
      .specifier_type(SpecifierType::Esm)
      .source_asset_id(asset_a_id.clone())
      .build();
    let dep_a_b_node_id = asset_graph.add_dependency(dep_a_b, false);
    asset_graph.add_edge(&asset_a_node_id, &dep_a_b_node_id);

    let asset_b = create_asset("b.js");
    let asset_b_id = asset_b.id.clone();
    let asset_b_node_id = asset_graph.add_asset(Arc::new(asset_b), false);
    asset_graph.add_edge(&dep_a_b_node_id, &asset_b_node_id);

    // A -> Async(C)
    let dep_a_c = DependencyBuilder::default()
      .specifier("c.js".to_string())
      .priority(Priority::Lazy)
      .env(Arc::new(Environment::default()))
      .specifier_type(SpecifierType::Esm)
      .source_asset_id(asset_a_id.clone())
      .build();
    let dep_a_c_node_id = asset_graph.add_dependency(dep_a_c, false);
    asset_graph.add_edge(&asset_a_node_id, &dep_a_c_node_id);

    let asset_c = create_asset("c.js");
    let asset_c_id = asset_c.id.clone();
    let asset_c_node_id = asset_graph.add_asset(Arc::new(asset_c), false);
    asset_graph.add_edge(&dep_a_c_node_id, &asset_c_node_id);

    // B -> D (Sync)
    let dep_b_d = DependencyBuilder::default()
      .specifier("d.js".to_string())
      .priority(Priority::Sync)
      .env(Arc::new(Environment::default()))
      .specifier_type(SpecifierType::Esm)
      .source_asset_id(asset_b_id.clone())
      .build();
    let dep_b_d_node_id = asset_graph.add_dependency(dep_b_d, false);
    asset_graph.add_edge(&asset_b_node_id, &dep_b_d_node_id);

    let asset_d = create_asset("d.js");
    let asset_d_node_id = asset_graph.add_asset(Arc::new(asset_d), false);
    asset_graph.add_edge(&dep_b_d_node_id, &asset_d_node_id);

    // C -> D (Sync)
    let dep_c_d = DependencyBuilder::default()
      .specifier("d.js".to_string())
      .priority(Priority::Sync)
      .env(Arc::new(Environment::default()))
      .specifier_type(SpecifierType::Esm)
      .source_asset_id(asset_c_id.clone())
      .build();
    let dep_c_d_node_id = asset_graph.add_dependency(dep_c_d, false);
    asset_graph.add_edge(&asset_c_node_id, &dep_c_d_node_id);
    asset_graph.add_edge(&dep_c_d_node_id, &asset_d_node_id);

    // Run
    let options = AtlaspackOptions::default();
    let ideal_graph = create_ideal_graph(&asset_graph, &options);

    // Check Assets
    let asset_d_idx = ideal_graph
      .assets
      .iter()
      .position(|&id| id == asset_d_node_id)
      .unwrap();

    // Check Bundle Graph
    // Should have Root A, Root B, Root C.
    // And Shared Bundle for D.
    // Total 4 bundles.

    assert_eq!(ideal_graph.bundle_graph.node_count(), 4);

    // Check Assignments
    let d_bundles = &ideal_graph.asset_to_bundles[asset_d_idx];
    assert_eq!(d_bundles.len(), 1);

    // Verify it is a shared bundle
    let shared_bundle_idx = d_bundles[0];
    let shared_bundle = &ideal_graph.bundle_graph[shared_bundle_idx];
    assert!(shared_bundle.id.starts_with("shared_"));

    // Verify connections
    // Sources of Shared Bundle should be B and C.
    // Find Root B and Root C bundle indices
    let asset_b_idx = ideal_graph
      .assets
      .iter()
      .position(|&id| id == asset_b_node_id)
      .unwrap();
    let asset_c_idx = ideal_graph
      .assets
      .iter()
      .position(|&id| id == asset_c_node_id)
      .unwrap();

    let _root_b_idx = ideal_graph
      .bundle_root_graph
      .node_indices()
      .find(|&idx| ideal_graph.bundle_root_graph[idx] == asset_b_idx)
      .unwrap();

    let _root_c_idx = ideal_graph
      .bundle_root_graph
      .node_indices()
      .find(|&idx| ideal_graph.bundle_root_graph[idx] == asset_c_idx)
      .unwrap();

    // We need to map Root Node Index to Bundle Graph Node Index.
    // We can search in bundle_graph for bundles with corresponding ids/entry assets.
    // Bundle B id is "b.js" (from create_asset in test).
    // wait, create_asset sets path, but id? Asset::new generates ID?
    // Asset::new(...) -> ID is hash of path usually or passed?
    // The implementation of create_ideal_graph uses `asset.id`.
    // We need to know the IDs.
    // In `create_asset` helper, `id` field is not explicit, it is calculated?
    // `Asset::new` computes ID.
    // Let's iterate bundle_graph and check for edges to shared_bundle_idx.

    let sources = ideal_graph
      .bundle_graph
      .neighbors_directed(shared_bundle_idx, petgraph::Direction::Incoming);

    let count = sources.clone().count();
    assert_eq!(count, 2);

    // Verify sources are B and C
    // ...
  }
}
