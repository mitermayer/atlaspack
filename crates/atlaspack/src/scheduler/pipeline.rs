use anyhow::anyhow;
use atlaspack_core::plugin::{TransformContext, TransformResult};
use atlaspack_core::types::{Asset, AssetWithDependencies};
use std::collections::VecDeque;
use std::path::Path;

use crate::plugins::PluginsRef;

pub struct PipelineScheduler;

impl PipelineScheduler {
  pub async fn execute(
    transform_context: TransformContext,
    input: Asset,
    plugins: PluginsRef,
    project_root: &Path,
  ) -> anyhow::Result<TransformResult> {
    let mut invalidations = vec![];
    let mut asset_queue = VecDeque::from([(
      AssetWithDependencies {
        asset: input,
        dependencies: Vec::new(),
      },
      None,
    )]);
    let mut initial_asset: Option<Asset> = None;
    let mut initial_asset_dependencies = None;
    let mut processed_assets: Vec<AssetWithDependencies> = vec![];

    while let Some((
      AssetWithDependencies {
        asset: asset_to_modify,
        dependencies,
      },
      pipeline,
    )) = asset_queue.pop_front()
    {
      let original_asset_type = asset_to_modify.file_type.clone();
      let (mut pipeline, pipeline_id) = if let Some(pipeline_info) = pipeline {
        pipeline_info
      } else {
        let mut file_path = asset_to_modify.file_path.clone();
        file_path.set_extension(asset_to_modify.file_type.extension());

        let pipeline = plugins.transformers(&file_path, asset_to_modify.pipeline.clone())?;
        let pipeline_id = pipeline.id();

        (pipeline, pipeline_id)
      };

      let mut current_asset = asset_to_modify.clone();
      let mut current_dependencies = dependencies;
      let mut pipeline_complete = true;

      for transformer in pipeline.transformers_mut() {
        let transform_result = transformer
          .transform(transform_context.clone(), current_asset)
          .await?;

        current_asset = transform_result.asset;

        current_dependencies.extend(transform_result.dependencies);
        invalidations.extend(transform_result.invalidate_on_file_change);
        asset_queue.extend(
          transform_result
            .discovered_assets
            .into_iter()
            .map(|discovered_asset| (discovered_asset, None)),
        );

        // If the Asset has changed type then we may need to trigger a different pipeline
        if current_asset.file_type != original_asset_type {
          // When the Asset changes file_type we need to regenerate its id
          current_asset.update_id(project_root);

          let next_pipeline = plugins.transformers(
            &current_asset
              .file_path
              .with_extension(current_asset.file_type.extension()),
            current_asset.pipeline.clone(),
          )?;

          let next_pipeline_id = next_pipeline.id();

          if next_pipeline_id != pipeline_id {
            asset_queue.push_front((
              AssetWithDependencies {
                asset: current_asset.clone(),
                dependencies: current_dependencies.clone(),
              },
              Some((next_pipeline, next_pipeline_id)),
            ));
            pipeline_complete = false;
            break;
          }
        }
      }

      if pipeline_complete {
        // We assume the first asset to complete the pipeline is the initial asset
        if initial_asset.is_none() {
          initial_asset = Some(current_asset);
          initial_asset_dependencies = Some(current_dependencies);
        } else {
          processed_assets.push(AssetWithDependencies {
            asset: current_asset,
            dependencies: current_dependencies,
          });
        }
      }
    }

    Ok(TransformResult {
      asset: initial_asset
        .ok_or_else(|| anyhow!("Initial asset missing after transformer pipeline"))?,
      dependencies: initial_asset_dependencies
        .ok_or_else(|| anyhow!("Initial asset missing after transformer pipeline"))?,
      discovered_assets: processed_assets,
      invalidate_on_file_change: invalidations,
    })
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::plugins::MockPlugins;
  use crate::plugins::TransformerPipeline;
  use atlaspack_core::hash::IdentifierHasher;
  use atlaspack_core::plugin::MockTransformerPlugin;
  use atlaspack_core::types::Code;
  use atlaspack_core::types::Dependency;
  use atlaspack_core::types::FileType;
  use pretty_assertions::assert_eq;
  use std::hash::Hash;
  use std::hash::Hasher;
  use std::path::PathBuf;
  use std::sync::Arc;

  fn make_asset(file_path: &str, file_type: FileType) -> Asset {
    Asset {
      file_path: PathBuf::from(file_path),
      file_type,
      ..Default::default()
    }
  }

  fn assert_code(asset: &Asset, code: &str) {
    assert_eq!(
      String::from_utf8(asset.code.bytes().to_vec()).unwrap(),
      code
    )
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn test_run_pipelines_works() {
    let mut plugins = MockPlugins::new();
    plugins.expect_transformers().returning(move |_, _| {
      Ok(TransformerPipeline::new(vec![
        make_transformer(MockTrasformerOptions {
          label: "transformer1",
          ..Default::default()
        }),
        make_transformer(MockTrasformerOptions {
          label: "transformer2",
          ..Default::default()
        }),
      ]))
    });

    let asset = Asset::default();
    let context = TransformContext::default();
    let result = PipelineScheduler::execute(context, asset, Arc::new(plugins), &PathBuf::default())
      .await
      .unwrap();

    assert_code(&result.asset, "::transformer1::transformer2");
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn test_run_pipelines_with_invalidations() {
    let mut plugins = MockPlugins::new();
    plugins
      .expect_transformers()
      .withf(|path: &Path, _pipeline: &Option<String>| {
        path.extension().is_some_and(|ext| ext == "js")
      })
      .returning(move |_, _| {
        Ok(TransformerPipeline::new(vec![
          make_transformer(MockTrasformerOptions {
            label: "js-1",
            ..Default::default()
          }),
          make_transformer(MockTrasformerOptions {
            label: "js-2",
            invalidate_on_file_change: Some(vec![PathBuf::from("./tmp")]),
            ..Default::default()
          }),
        ]))
      });

    let asset = make_asset("index.js", FileType::Js);
    let expected_invalidations = vec![PathBuf::from("./tmp")];
    let context = TransformContext::default();
    let result = PipelineScheduler::execute(context, asset, Arc::new(plugins), &PathBuf::default())
      .await
      .unwrap();

    assert_code(&result.asset, "::js-1::js-2");
    assert_eq!(result.invalidate_on_file_change, expected_invalidations);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn test_run_pipelines_with_updated_file_type() {
    let mut plugins = MockPlugins::new();
    plugins
      .expect_transformers()
      .withf(|path: &Path, _pipeline: &Option<String>| {
        path.extension().is_some_and(|ext| ext == "json")
      })
      .returning(move |_, _| {
        Ok(TransformerPipeline::new(vec![make_transformer(
          MockTrasformerOptions {
            label: "json",
            updated_file_type: Some(FileType::Js),
            ..Default::default()
          },
        )]))
      })
      .times(1);

    plugins
      .expect_transformers()
      .withf(|path: &Path, _pipeline: &Option<String>| {
        path.extension().is_some_and(|ext| ext == "js")
      })
      .returning(move |_, _| {
        Ok(TransformerPipeline::new(vec![make_transformer(
          MockTrasformerOptions {
            label: "js",
            ..Default::default()
          },
        )]))
      });

    let asset = make_asset("index.json", FileType::Json);
    let context = TransformContext::default();
    let result = PipelineScheduler::execute(context, asset, Arc::new(plugins), &PathBuf::default())
      .await
      .unwrap();

    assert_eq!(
      result.asset.clone(),
      Asset {
        id: "531e3635c3398c55".into(),
        file_type: FileType::Js,
        ..result.asset
      }
    );
    assert_eq!(result.discovered_assets.len(), 0);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn test_run_pipelines_with_dependencies() {
    let mut plugins = MockPlugins::new();
    plugins
      .expect_transformers()
      .withf(|path: &Path, _pipeline: &Option<String>| {
        path.extension().is_some_and(|ext| ext == "js")
      })
      .returning(move |_, _| {
        Ok(TransformerPipeline::new(vec![
          make_transformer(MockTrasformerOptions {
            label: "js-1",
            ..Default::default()
          }),
          make_transformer(MockTrasformerOptions {
            label: "js-2",
            dependencies: Some(vec![Dependency::default()]),
            ..Default::default()
          }),
        ]))
      });

    let asset = make_asset("index.js", FileType::Js);
    let expected_dependencies = vec![Dependency::default()];
    let context = TransformContext::default();
    let result = PipelineScheduler::execute(context, asset, Arc::new(plugins), &PathBuf::default())
      .await
      .unwrap();

    assert_code(&result.asset, "::js-1::js-2");
    assert_eq!(result.dependencies, expected_dependencies);
  }

  #[tokio::test(flavor = "multi_thread")]
  async fn test_run_pipelines_with_discovered_assets() {
    let mut plugins = MockPlugins::new();

    plugins
      .expect_transformers()
      .withf(|path: &Path, _pipeline: &Option<String>| {
        path.extension().is_some_and(|ext| ext == "js")
      })
      .returning(move |_, _| {
        Ok(TransformerPipeline::new(vec![
          make_transformer(MockTrasformerOptions {
            label: "js-1",
            ..Default::default()
          }),
          make_transformer(MockTrasformerOptions {
            label: "js-2",
            discovered_assets: Some(vec![AssetWithDependencies {
              asset: make_asset("discovered.css", FileType::Css),
              dependencies: vec![Dependency::default()],
            }]),
            ..Default::default()
          }),
        ]))
      });

    plugins
      .expect_transformers()
      .withf(|path: &Path, _pipeline: &Option<String>| {
        path.extension().is_some_and(|ext| ext == "css")
      })
      .returning(move |_, _| {
        Ok(TransformerPipeline::new(vec![
          make_transformer(MockTrasformerOptions {
            label: "css-1",
            ..Default::default()
          }),
          make_transformer(MockTrasformerOptions {
            label: "css-2",
            dependencies: Some(vec![Dependency::default()]),
            ..Default::default()
          }),
        ]))
      });

    let asset = make_asset("index.js", FileType::Js);
    let context = TransformContext::default();
    let result = PipelineScheduler::execute(context, asset, Arc::new(plugins), &PathBuf::default())
      .await
      .unwrap();

    assert_code(&result.asset, "::js-1::js-2");
    assert_eq!(result.discovered_assets.len(), 1);
    assert_code(&result.discovered_assets[0].asset, "::css-1::css-2");
    assert_eq!(result.discovered_assets[0].dependencies.len(), 2);
  }

  #[derive(Default)]
  struct MockTrasformerOptions<'a> {
    label: &'a str,
    discovered_assets: Option<Vec<AssetWithDependencies>>,
    dependencies: Option<Vec<Dependency>>,
    invalidate_on_file_change: Option<Vec<PathBuf>>,
    updated_file_type: Option<FileType>,
  }
  fn make_transformer(options: MockTrasformerOptions) -> Arc<MockTransformerPlugin> {
    let MockTrasformerOptions {
      label,
      discovered_assets,
      dependencies,
      invalidate_on_file_change,
      updated_file_type,
    } = options;
    let label = label.to_string();
    let mut mock = MockTransformerPlugin::new();
    mock.expect_id().returning({
      let label = label.clone();
      move || {
        let mut hasher = IdentifierHasher::new();
        label.hash(&mut hasher);
        hasher.finish()
      }
    });

    mock.expect_transform().returning({
      let label = label.clone();
      move |_context, asset: Asset| {
        let mut asset = asset.clone();
        asset.code = Code::from(format!(
          "{}::{}",
          String::from_utf8(asset.code.bytes().to_vec()).unwrap(),
          label.clone()
        ));

        if let Some(file_type) = updated_file_type.clone() {
          asset.file_type = file_type;
        }

        Ok(TransformResult {
          asset,
          discovered_assets: discovered_assets.clone().unwrap_or_default(),
          dependencies: dependencies.clone().unwrap_or_default(),
          invalidate_on_file_change: invalidate_on_file_change.clone().unwrap_or_default(),
        })
      }
    });
    // .returning(move |_context, asset: Asset| get_simple_transformer(label.clone(), asset));
    Arc::new(mock)
  }
}
