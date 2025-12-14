use crate::nodejs::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;
use async_trait::async_trait;
use atlaspack_config::PluginNode;
use atlaspack_core::plugin::PackageContext;
use atlaspack_core::plugin::PackagedBundle;
use atlaspack_core::plugin::PackagerPlugin;
use atlaspack_core::plugin::PluginContext;
use std::fmt;
use std::fmt::Debug;
use std::sync::Arc;

pub struct NodejsRpcPackagerPlugin {
  _name: String,
  workers: Arc<NodeJsWorkerCollection>,
}

impl Debug for NodejsRpcPackagerPlugin {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "RpcPackagerPlugin")
  }
}

impl NodejsRpcPackagerPlugin {
  pub fn new(
    workers: Arc<NodeJsWorkerCollection>,
    _ctx: &PluginContext,
    plugin: &PluginNode,
  ) -> Result<Self, anyhow::Error> {
    Ok(NodejsRpcPackagerPlugin {
      _name: plugin.package_name.clone(),
      workers,
    })
  }
}

#[async_trait]
impl PackagerPlugin for NodejsRpcPackagerPlugin {
  async fn package<'a>(&self, ctx: PackageContext<'a>) -> Result<PackagedBundle, anyhow::Error> {
    let worker = self.workers.next_worker();
    let args = serde_json::json!({
      "bundle": ctx.bundle,
      "bundleGraph": null
    });
    worker.packager_package_fn.call_serde(args).await
  }
}
