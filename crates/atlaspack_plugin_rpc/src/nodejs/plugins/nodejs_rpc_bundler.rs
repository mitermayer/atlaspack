use async_trait::async_trait;
use atlaspack_config::PluginNode;
use atlaspack_core::bundle_graph::BundleGraph;
use atlaspack_core::plugin::BundlerPlugin;
use atlaspack_core::plugin::PluginContext;
use std::fmt;
use std::fmt::Debug;
use std::sync::Arc;

use crate::nodejs::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;

pub struct NodejsRpcBundlerPlugin {
  _name: String,
  workers: Arc<NodeJsWorkerCollection>,
}

impl Debug for NodejsRpcBundlerPlugin {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "RpcBundlerPlugin")
  }
}

impl NodejsRpcBundlerPlugin {
  pub fn new(
    workers: Arc<NodeJsWorkerCollection>,
    _ctx: &PluginContext,
    plugin: &PluginNode,
  ) -> Result<Self, anyhow::Error> {
    Ok(NodejsRpcBundlerPlugin {
      _name: plugin.package_name.clone(),
      workers,
    })
  }
}

use atlaspack_core::asset_graph::AssetGraph;

#[async_trait]
impl BundlerPlugin for NodejsRpcBundlerPlugin {
  async fn bundle(
    &self,
    _bundle_graph: &mut BundleGraph,
    _asset_graph: &AssetGraph,
  ) -> Result<(), anyhow::Error> {
    let worker = self.workers.next_worker();
    // Placeholder args for now
    let opts = serde_json::json!({
        "bundleGraph": null // We haven't implemented NAPI BundleGraph wrapper yet
    });
    worker.bundler_bundle_fn.call_serde::<_, ()>(opts).await?;
    Ok(())
  }

  async fn optimize(
    &self,
    _bundle_graph: &mut BundleGraph,
    _asset_graph: &AssetGraph,
  ) -> Result<(), anyhow::Error> {
    todo!()
  }
}
