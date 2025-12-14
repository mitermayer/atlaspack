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

pub struct NodejsRpcRuntimePlugin {
  _name: String,
  workers: Arc<NodeJsWorkerCollection>,
}

impl Debug for NodejsRpcRuntimePlugin {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "RpcRuntimePlugin")
  }
}

impl NodejsRpcRuntimePlugin {
  pub fn new(
    workers: Arc<NodeJsWorkerCollection>,
    _ctx: &PluginContext,
    plugin: &PluginNode,
  ) -> Result<Self, anyhow::Error> {
    Ok(NodejsRpcRuntimePlugin {
      _name: plugin.package_name.clone(),
      workers,
    })
  }
}

#[async_trait]
impl RuntimePlugin for NodejsRpcRuntimePlugin {
  async fn apply(
    &self,
    bundle: Bundle,
    _bundle_graph: BundleGraph,
  ) -> Result<Option<Vec<RuntimeAsset>>, anyhow::Error> {
    let worker = self.workers.next_worker();
    let args = serde_json::json!({
      "bundle": bundle,
      "bundleGraph": null
    });
    worker.runtime_apply_fn.call_serde(args).await
  }
}
