use crate::nodejs::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;
use async_trait::async_trait;
use atlaspack_config::PluginNode;
use atlaspack_core::plugin::OptimizeContext;
use atlaspack_core::plugin::OptimizedBundle;
use atlaspack_core::plugin::OptimizerPlugin;
use atlaspack_core::plugin::PluginContext;
use std::fmt;
use std::fmt::Debug;
use std::sync::Arc;

pub struct NodejsRpcOptimizerPlugin {
  _name: String,
  workers: Arc<NodeJsWorkerCollection>,
}

impl Debug for NodejsRpcOptimizerPlugin {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "RpcOptimizerPlugin")
  }
}

impl NodejsRpcOptimizerPlugin {
  pub fn new(
    workers: Arc<NodeJsWorkerCollection>,
    _ctx: &PluginContext,
    plugin: &PluginNode,
  ) -> Result<Self, anyhow::Error> {
    Ok(NodejsRpcOptimizerPlugin {
      _name: plugin.package_name.clone(),
      workers,
    })
  }
}

#[async_trait]
impl OptimizerPlugin for NodejsRpcOptimizerPlugin {
  async fn optimize<'a>(&self, ctx: OptimizeContext<'a>) -> Result<OptimizedBundle, anyhow::Error> {
    let worker = self.workers.next_worker();
    let args = serde_json::json!({
      "bundle": ctx.bundle,
      "bundleGraph": null,
      "contents": ctx.contents
    });
    worker.optimizer_optimize_fn.call_serde(args).await
  }
}
