use crate::nodejs::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;
use async_trait::async_trait;
use atlaspack_config::PluginNode;
use atlaspack_core::bundle_graph::BundleGraph;
use atlaspack_core::plugin::NamerPlugin;
use atlaspack_core::plugin::PluginContext;
use atlaspack_core::types::Bundle;
use serde::Deserialize;
use std::fmt;
use std::fmt::Debug;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Deserialize)]
struct JsNamerResult {
  name: Option<PathBuf>,
}

pub struct NodejsRpcNamerPlugin {
  _name: String,
  workers: Arc<NodeJsWorkerCollection>,
}

impl Debug for NodejsRpcNamerPlugin {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "RpcNamerPlugin")
  }
}

impl NodejsRpcNamerPlugin {
  pub fn new(
    workers: Arc<NodeJsWorkerCollection>,
    _ctx: &PluginContext,
    plugin: &PluginNode,
  ) -> Result<Self, anyhow::Error> {
    Ok(NodejsRpcNamerPlugin {
      _name: plugin.package_name.clone(),
      workers,
    })
  }
}

#[async_trait]
impl NamerPlugin for NodejsRpcNamerPlugin {
  async fn name(
    &self,
    bundle: &Bundle,
    _bundle_graph: &BundleGraph,
  ) -> Result<Option<std::path::PathBuf>, anyhow::Error> {
    let worker = self.workers.next_worker();
    let args = serde_json::json!({
      "bundle": bundle,
      "bundleGraph": null
    });
    let result: JsNamerResult = worker.namer_name_fn.call_serde(args).await?;
    Ok(result.name)
  }
}
