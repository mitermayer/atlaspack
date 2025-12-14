use crate::nodejs::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;
use async_trait::async_trait;
use atlaspack_config::PluginNode;
use atlaspack_core::plugin::CompressedFile;
use atlaspack_core::plugin::CompressorPlugin;
use atlaspack_core::plugin::PluginContext;
use std::fmt;
use std::fmt::Debug;
use std::fs::File;
use std::sync::Arc;

pub struct NodejsRpcCompressorPlugin {
  _name: String,
  workers: Arc<NodeJsWorkerCollection>,
}

impl Debug for NodejsRpcCompressorPlugin {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "RpcCompressorPlugin")
  }
}

impl NodejsRpcCompressorPlugin {
  pub fn new(
    workers: Arc<NodeJsWorkerCollection>,
    _ctx: &PluginContext,
    plugin: &PluginNode,
  ) -> anyhow::Result<Self> {
    Ok(NodejsRpcCompressorPlugin {
      _name: plugin.package_name.clone(),
      workers,
    })
  }
}

#[async_trait]
impl CompressorPlugin for NodejsRpcCompressorPlugin {
  async fn compress(&self, _file: &File) -> Result<Option<CompressedFile>, String> {
    let worker = self.workers.next_worker();
    let args = serde_json::json!({
      "stream": null
    });
    worker
      .compressor_compress_fn
      .call_serde(args)
      .await
      .map_err(|e| e.to_string())
  }
}
