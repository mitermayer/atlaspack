use crate::nodejs::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;
use async_trait::async_trait;
use atlaspack_config::PluginNode;
use atlaspack_core::bundle_graph::BundleGraph;
use atlaspack_core::plugin::PluginContext;
use atlaspack_core::plugin::RuntimeAsset;
use atlaspack_core::plugin::RuntimePlugin;
use atlaspack_core::types::Bundle;
use std::fmt;
use std::fmt::Debug;
use std::sync::Arc;
use serde::{Deserialize, Serialize};

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
    let hmr_options = ctx.options.hmr_options.as_ref().map(|h| {
      super::plugin_options::RpcHmrOptions {
        port: h.port.map(|p| p as u16),
        host: h.host.clone(),
      }
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
struct RuntimeBundleGraphDto {
  bundle_id: String,
}

#[async_trait]
impl RuntimePlugin for NodejsRpcRuntimePlugin {
  async fn apply(
    &self,
    bundle: Bundle,
    _bundle_graph: BundleGraph,
  ) -> Result<Option<Vec<RuntimeAsset>>, anyhow::Error> {
    let worker = self.workers.next_worker();
    let dto = RuntimeBundleGraphDto {
      bundle_id: bundle.id.to_string(),
    };
    worker
      .runtime_apply_fn
      .call_serde((bundle, dto, self.options.clone()))
      .await
  }
}
