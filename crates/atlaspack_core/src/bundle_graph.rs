use std::sync::Arc;

use petgraph::stable_graph::StableDiGraph;
use serde::{Deserialize, Serialize};

use crate::types::{Asset, Bundle, Dependency, Target};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct BundleGroup {
  pub target: Target,
  pub entry_asset_id: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum BundleGraphNode {
  Asset(Arc<Asset>),
  Dependency(Arc<Dependency>),
  Bundle(Box<Bundle>),
  BundleGroup(Box<BundleGroup>),
  Root,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BundleGraphEdgeType {
  Null,
  Contains,
  Bundle,
  References,
  InternalAsync,
  Conditional,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BundleGraph {
  pub graph: StableDiGraph<BundleGraphNode, BundleGraphEdgeType>,
}

impl PartialEq for BundleGraph {
  fn eq(&self, other: &Self) -> bool {
    self.graph.node_count() == other.graph.node_count()
      && self.graph.edge_count() == other.graph.edge_count()
  }
}

impl BundleGraph {
  pub fn new() -> Self {
    let mut graph = StableDiGraph::new();
    graph.add_node(BundleGraphNode::Root);
    Self { graph }
  }
}
