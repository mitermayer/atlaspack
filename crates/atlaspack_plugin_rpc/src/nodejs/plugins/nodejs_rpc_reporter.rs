use crate::nodejs::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;
use async_trait::async_trait;
use atlaspack_config::PluginNode;
use atlaspack_core::plugin::PluginContext;
use atlaspack_core::plugin::ReporterEvent;
use atlaspack_core::plugin::ReporterPlugin;
use std::fmt;
use std::fmt::Debug;
use std::sync::Arc;

pub struct NodejsRpcReporterPlugin {
  _name: String,
  workers: Arc<NodeJsWorkerCollection>,
}

impl Debug for NodejsRpcReporterPlugin {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "RpcReporterPlugin")
  }
}

impl NodejsRpcReporterPlugin {
  pub fn new(
    workers: Arc<NodeJsWorkerCollection>,
    _ctx: &PluginContext,
    plugin: &PluginNode,
  ) -> anyhow::Result<Self> {
    Ok(NodejsRpcReporterPlugin {
      _name: plugin.package_name.clone(),
      workers,
    })
  }
}

#[async_trait]
impl ReporterPlugin for NodejsRpcReporterPlugin {
  async fn report(&self, event: &ReporterEvent) -> Result<(), anyhow::Error> {
    let worker = self.workers.next_worker();
    let args = serde_json::json!({
      "event": event
    });
    worker.reporter_report_fn.call_serde(args).await
  }
}
