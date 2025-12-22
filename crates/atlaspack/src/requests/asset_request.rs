use async_trait::async_trait;
use atlaspack_core::config_loader::ConfigLoader;
use atlaspack_core::hash::hash_bytes;
use atlaspack_core::plugin::AssetBuildEvent;
use atlaspack_core::plugin::BuildProgressEvent;
use atlaspack_core::plugin::ReporterEvent;
use atlaspack_core::plugin::TransformContext;
use atlaspack_core::types::AssetStats;
use atlaspack_core::types::AssetWithDependencies;
use atlaspack_core::types::Code;
use atlaspack_core::types::Dependency;
use atlaspack_core::types::Environment;
use atlaspack_core::types::FileType;
use atlaspack_core::types::{Asset, Invalidation};
use atlaspack_sourcemap::find_sourcemap_url;
use atlaspack_sourcemap::load_sourcemap_url;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use crate::request_tracker::{Request, ResultAndInvalidations, RunRequestContext, RunRequestError};
use crate::scheduler::pipeline::PipelineScheduler;

use super::RequestResult;
use serde::{Deserialize, Serialize};

/// The AssetRequest runs transformer plugins on discovered Assets.
/// - Decides which transformer pipeline to run from the input Asset type
/// - Runs the pipeline in series, switching pipeline if the Asset type changes
/// - Stores the final Asset source code in the cache, for access in packaging
/// - Finally, returns the complete Asset and it's discovered Dependencies
#[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
pub struct AssetRequest {
  pub project_root: PathBuf,
  pub code: Option<String>,
  pub env: Arc<Environment>,
  pub file_path: PathBuf,
  pub pipeline: Option<String>,
  pub query: Option<String>,
  pub side_effects: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AssetRequestOutput {
  pub asset: Arc<Asset>,
  pub discovered_assets: Vec<AssetWithDependencies>,
  pub dependencies: Vec<Dependency>,
}

#[async_trait]
impl Request for AssetRequest {
  #[tracing::instrument(level = "trace", skip_all)]
  async fn run(
    &self,
    request_context: RunRequestContext,
  ) -> Result<ResultAndInvalidations, RunRequestError> {
    request_context
      .report(ReporterEvent::BuildProgress(BuildProgressEvent::Building(
        AssetBuildEvent {
          file_path: self.file_path.clone(),
        },
      )))
      .await;

    let start = Instant::now();

    let code = if let Some(code) = self.code.as_ref() {
      Code::from(code.to_owned())
    } else {
      let code_from_disk = request_context.file_system().read(&self.file_path)?;
      Code::new(code_from_disk)
    };

    let mut asset = Asset::new(
      code,
      self.code.is_some(),
      self.env.clone(),
      self.file_path.clone(),
      self.pipeline.clone(),
      &self.project_root,
      self.query.clone(),
      self.side_effects,
    )?;

    // Load an existing sourcemap if available for valid file types
    if matches!(
      asset.file_type,
      FileType::Css | FileType::Js | FileType::Jsx | FileType::Ts | FileType::Tsx,
    ) {
      let code = asset.code.as_str()?;

      if let Some(url_match) = find_sourcemap_url(code) {
        // Sourcemaps are intentionally skipped if they are invalid
        if let Ok(source_map) = load_sourcemap_url(
          request_context.file_system(),
          &self.project_root,
          &self.file_path,
          &url_match.url,
        ) {
          asset.map = Some(source_map);
          asset.code = Code::from(code.replace(&url_match.code, ""));
        }
      }
    }

    let config_loader = Arc::new(ConfigLoader {
      fs: request_context.file_system().clone(),
      project_root: request_context.project_root.clone(),
      search_path: asset.file_path.clone(),
    });

    let transform_context = TransformContext::new(config_loader, self.env.clone());
    let mut result = PipelineScheduler::execute(
      transform_context,
      asset,
      request_context.plugins().clone(),
      &request_context.project_root,
    )
    .await?;

    // TODO: Commit the asset with a project path now, as transformers rely on an absolute path
    // result.asset.file_path = to_project_path(&self.project_root, &result.asset.file_path);

    result.asset.stats = AssetStats {
      size: result.asset.code.size(),
      time: start.elapsed().as_millis().try_into().unwrap_or(u32::MAX),
    };

    // Assign the output hash for the Asset now that all transforms have been
    // applied
    result.asset.output_hash = Some(hash_bytes(result.asset.code.bytes()));

    // Ensure the asset source file is marked as an invalidation
    result
      .invalidate_on_file_change
      .push(result.asset.file_path.clone());

    Ok(ResultAndInvalidations {
      result: RequestResult::Asset(AssetRequestOutput {
        asset: Arc::new(result.asset),
        // TODO: Need to decide whether a discovered asset will belong to the asset graph as it's own node
        discovered_assets: result.discovered_assets,
        dependencies: result.dependencies,
      }),
      invalidations: result
        .invalidate_on_file_change
        .into_iter()
        .map(Invalidation::FileChange)
        .collect(),
    })
  }
}
