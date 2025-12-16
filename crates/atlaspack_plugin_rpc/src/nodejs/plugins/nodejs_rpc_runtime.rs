use crate::nodejs::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;
use async_trait::async_trait;
use atlaspack_config::PluginNode;
use atlaspack_core::bundle_graph::{BundleGraph, BundleGraphEdgeType, BundleGraphNode};
use atlaspack_core::plugin::PluginContext;
use atlaspack_core::plugin::RuntimeAsset;
use atlaspack_core::plugin::RuntimePlugin;
use atlaspack_core::types::Bundle;
use petgraph::Direction;
use petgraph::visit::EdgeRef;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::fmt::Debug;
use std::sync::Arc;

use super::plugin_options::RpcPluginOptions;

pub struct NodejsRpcRuntimePlugin {
  _name: String,
  workers: Arc<NodeJsWorkerCollection>,
  options: RpcPluginOptions,
}

impl Debug for NodejsRpcRuntimePlugin {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "RpcRuntimePlugin")
  }
}

impl NodejsRpcRuntimePlugin {
  pub fn new(
    workers: Arc<NodeJsWorkerCollection>,
    ctx: &PluginContext,
    plugin: &PluginNode,
  ) -> Result<Self, anyhow::Error> {
    let hmr_options =
      ctx
        .options
        .hmr_options
        .as_ref()
        .map(|h| super::plugin_options::RpcHmrOptions {
          port: h.port.map(|p| p as u16),
          host: h.host.clone(),
        });

    Ok(NodejsRpcRuntimePlugin {
      _name: plugin.package_name.clone(),
      workers,
      options: RpcPluginOptions {
        hmr_options,
        project_root: ctx.options.project_root.clone(),
        mode: ctx.options.mode.clone(),
      },
    })
  }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BundleGroupDto {
  bundle_ids: Vec<String>,
  entry_asset_id: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeBundleGraphDto {
  bundle_id: String,
  resolutions: HashMap<String, String>,
  bundle_groups: HashMap<String, BundleGroupDto>,
}

#[async_trait]
impl RuntimePlugin for NodejsRpcRuntimePlugin {
  async fn apply(
    &self,
    bundle: Bundle,
    bundle_graph: BundleGraph,
  ) -> Result<Option<Vec<RuntimeAsset>>, anyhow::Error> {
    let bundle_node_index = bundle_graph
      .graph
      .node_indices()
      .find(|&idx| {
        if let BundleGraphNode::Bundle(b) = &bundle_graph.graph[idx] {
          b.id == bundle.id
        } else {
          false
        }
      })
      .ok_or_else(|| anyhow::anyhow!("Bundle node not found in graph"))?;

    let mut resolutions = HashMap::new();
    let mut bundle_groups = HashMap::new();

    for edge in bundle_graph
      .graph
      .edges_directed(bundle_node_index, Direction::Outgoing)
    {
      if *edge.weight() == BundleGraphEdgeType::Contains {
        let asset_node_idx = edge.target();
        // Check if it is really an asset (it should be)
        if let BundleGraphNode::Asset(_) = &bundle_graph.graph[asset_node_idx] {
          // Find dependencies
          for dep_edge in bundle_graph
            .graph
            .edges_directed(asset_node_idx, Direction::Outgoing)
          {
            let dep_node_idx = dep_edge.target();
            if let BundleGraphNode::Dependency(dep) = &bundle_graph.graph[dep_node_idx] {
              // Resolve dependency
              // Check what this dependency points to
              for res_edge in bundle_graph
                .graph
                .edges_directed(dep_node_idx, Direction::Outgoing)
              {
                let target_idx = res_edge.target();
                if let BundleGraphNode::BundleGroup(bg) = &bundle_graph.graph[target_idx] {
                  // This is a resolution to a BundleGroup
                  let bg_id = target_idx.index().to_string();
                  resolutions.insert(dep.id.clone(), bg_id.clone());

                  if !bundle_groups.contains_key(&bg_id) {
                    // Populate BundleGroupDto
                    let mut bundle_ids = Vec::new();
                    // Find bundles in this group
                    for bg_edge in bundle_graph
                      .graph
                      .edges_directed(target_idx, Direction::Outgoing)
                    {
                      if *bg_edge.weight() == BundleGraphEdgeType::Bundle {
                        let b_idx = bg_edge.target();
                        if let BundleGraphNode::Bundle(b) = &bundle_graph.graph[b_idx] {
                          bundle_ids.push(b.id.clone());
                        }
                      }
                    }

                    bundle_groups.insert(
                      bg_id,
                      BundleGroupDto {
                        entry_asset_id: bg.entry_asset_id.clone(),
                        bundle_ids,
                      },
                    );
                  }
                }
              }
            }
          }
        }
      }
    }

    let worker = self.workers.next_worker();
    let dto = RuntimeBundleGraphDto {
      bundle_id: bundle.id.to_string(),
      resolutions,
      bundle_groups,
    };
    worker
      .runtime_apply_fn
      .call_serde((bundle, dto, self.options.clone()))
      .await
  }
}
