use std::hash::{Hash, Hasher};
use std::sync::Arc;

use anyhow::anyhow;
use async_trait::async_trait;
use atlaspack_core::bundle_graph::BundleGraph;

use crate::request_tracker::{Request, ResultAndInvalidations, RunRequestContext, RunRequestError};

use super::RequestResult;
use super::asset_graph_request::AssetGraphRequest;

#[derive(Debug, Default)]
pub struct BundleGraphRequest {
  // TODO: Add fields
}

impl Hash for BundleGraphRequest {
  fn hash<H: Hasher>(&self, _state: &mut H) {}
}

#[derive(Clone, Debug, PartialEq)]
pub struct BundleGraphRequestOutput {
  pub bundle_graph: Arc<BundleGraph>,
}

#[async_trait]
impl Request for BundleGraphRequest {
  async fn run(
    &self,
    mut request_context: RunRequestContext,
  ) -> Result<ResultAndInvalidations, RunRequestError> {
    let asset_graph_request = AssetGraphRequest::default();

    let (result, _id, _cached) = request_context.execute_request(asset_graph_request).await?;

    let _asset_graph = match result.as_ref() {
      RequestResult::AssetGraph(output) => &output.graph,
      _ => return Err(anyhow!("Expected AssetGraph output")),
    };

    let bundle_graph = Arc::new(BundleGraph::new());

    Ok(ResultAndInvalidations {
      result: RequestResult::BundleGraph(BundleGraphRequestOutput { bundle_graph }),
      invalidations: vec![],
    })
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::requests::RequestResult;
  use crate::test_utils::{RequestTrackerTestOptions, request_tracker};

  #[tokio::test(flavor = "multi_thread")]
  async fn test_bundle_graph_request() {
    let mut tracker = request_tracker(RequestTrackerTestOptions::default());
    let request = BundleGraphRequest::default();
    let result = tracker
      .run_request(request)
      .await
      .expect("Failed to run request");

    if let RequestResult::BundleGraph(output) = result.as_ref() {
      assert!(output.bundle_graph.graph.node_count() > 0); // At least Root
    } else {
      panic!("Wrong result type");
    }
  }
}
