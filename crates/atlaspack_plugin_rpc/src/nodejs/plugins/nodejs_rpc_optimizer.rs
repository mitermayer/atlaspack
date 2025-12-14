use crate::nodejs::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;
use async_trait::async_trait;
use atlaspack_config::PluginNode;
use atlaspack_core::plugin::OptimizeContext;
use atlaspack_core::plugin::OptimizedBundle;
use atlaspack_core::plugin::OptimizerPlugin;
use atlaspack_core::plugin::PluginContext;
use std::fmt;
use std::fmt::Debug;
use std::io::Read;
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

    // Read contents from file
    let mut contents = Vec::new();
    // Use a reference to the file to read
    (&*ctx.contents).read_to_end(&mut contents)?;

    // Convert to String if valid UTF-8, otherwise keep as bytes?
    // JSON supports strings, but for binary data we'd need base64 or similar.
    // For now, let's assume optimizers handle text (JS/CSS).
    // If it's an image optimizer, this will be problematic with String.
    // However, serde_json::json! will serialize Vec<u8> as [u8].
    // Let's check what the JS side expects.
    // If we send Vec<u8>, it becomes an array in JS. A Buffer would be better.
    // But we can't easily send Buffer via simple JSON.
    // We'll send it as String (lossy) for now if utf8, or maybe just array.
    // Actually, let's try to convert to string lossily.
    let contents_str = String::from_utf8_lossy(&contents).to_string();

    let args = serde_json::json!({
      "bundle": ctx.bundle,
      "bundleGraph": null,
      "contents": contents_str
    });

    worker.optimizer_optimize_fn.call_serde(args).await
  }
}
