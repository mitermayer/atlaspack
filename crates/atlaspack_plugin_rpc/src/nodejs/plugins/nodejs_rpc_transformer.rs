use async_trait::async_trait;
use atlaspack_core::plugin::PluginOptions;
use std::fmt;
use std::fmt::Debug;
use std::hash::Hash;
use std::hash::Hasher;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::OnceCell;

use anyhow::Error;
use atlaspack_core::hash::IdentifierHasher;
use serde::Deserialize;
use serde::Serialize;

use atlaspack_config::PluginNode;
use atlaspack_core::plugin::PluginContext;
use atlaspack_core::plugin::TransformContext;
use atlaspack_core::plugin::TransformResult;
use atlaspack_core::plugin::TransformerPlugin;
use atlaspack_core::types::Asset;
use atlaspack_core::types::InternalFileCreateInvalidation as InvalidateOnFileCreate;
use atlaspack_core::types::engines::Engines;
use atlaspack_core::types::*;

use super::super::rpc::LoadPluginKind;
use super::super::rpc::LoadPluginOptions;
use super::super::rpc::nodejs_rpc_worker_farm::NodeJsWorkerCollection;
use super::plugin_options::RpcPluginOptions;

/// Plugin state once initialized
struct InitializedState {
  rpc_plugin_options: RpcPluginOptions,
}

pub struct NodejsRpcTransformerPlugin {
  nodejs_workers: Arc<NodeJsWorkerCollection>,
  plugin_options: Arc<PluginOptions>,
  plugin_node: PluginNode,
  started: OnceCell<InitializedState>,
}

impl Debug for NodejsRpcTransformerPlugin {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "RpcTransformerPlugin({})", self.plugin_node.package_name)
  }
}

impl NodejsRpcTransformerPlugin {
  pub fn new(
    nodejs_workers: Arc<NodeJsWorkerCollection>,
    ctx: &PluginContext,
    plugin_node: &PluginNode,
  ) -> Result<Self, anyhow::Error> {
    Ok(Self {
      nodejs_workers,
      plugin_options: ctx.options.clone(),
      plugin_node: plugin_node.clone(),
      started: OnceCell::new(),
    })
  }

  async fn get_or_init_state(&self) -> anyhow::Result<&InitializedState> {
    self
      .started
      .get_or_try_init::<anyhow::Error, _, _>(|| async move {
        self
          .nodejs_workers
          .load_plugin(LoadPluginOptions {
            kind: LoadPluginKind::Transformer,
            specifier: self.plugin_node.package_name.clone(),
            #[allow(clippy::needless_borrow)]
            resolve_from: (&*self.plugin_node.resolve_from).clone(),
            feature_flags: Some(self.plugin_options.feature_flags.clone()),
          })
          .await?;

        Ok(InitializedState {
          rpc_plugin_options: RpcPluginOptions {
            hmr_options: None,
            project_root: self.plugin_options.project_root.clone(),
            mode: self.plugin_options.mode.clone(),
          },
        })
      })
      .await
  }
}

#[async_trait]
impl TransformerPlugin for NodejsRpcTransformerPlugin {
  fn id(&self) -> u64 {
    let mut hasher = IdentifierHasher::new();
    self.plugin_node.hash(&mut hasher);
    hasher.finish()
  }

  #[tracing::instrument(level = "debug", skip_all, fields(plugin = %self.plugin_node.package_name))]
  async fn transform(
    &self,
    _context: TransformContext,
    asset: Asset,
  ) -> Result<TransformResult, Error> {
    let state = self.get_or_init_state().await?;

    let asset_env = asset.env.clone();
    let stats = asset.stats.clone();

    let original_source_map = asset.map.clone();
    let source_map = if let Some(map) = asset.map.as_ref() {
      Some(map.clone().to_json(None)?)
    } else {
      None
    };

    let run_transformer_opts = RpcTransformerOpts {
      key: self.plugin_node.package_name.clone(),
      options: state.rpc_plugin_options.clone(),
      env: asset_env.clone(),
      asset: Asset {
        code: Default::default(),
        ..asset.clone()
      },
    };

    let asset_for_worker = asset.clone();
    let result = self
      .nodejs_workers
      .next_worker()
      .transformer_register_fn
      .call(
        move |env| {
          let run_transformer_opts = env.to_js_value(&run_transformer_opts)?;

          // Passing in an empty buffer causes napi to panic. If asset has no
          // code, we pass an empty Vec instead.
          let contents = if asset_for_worker.code.is_empty() {
            env.create_buffer_with_data(Vec::new())?
          } else {
            let mut contents = env.create_buffer(asset_for_worker.code.len())?;
            contents.copy_from_slice(&asset_for_worker.code);
            contents
          };

          let map = if let Some(map) = source_map {
            env.create_string(&map)?.into_unknown()
          } else {
            env.get_undefined()?.into_unknown()
          };

          Ok(vec![run_transformer_opts, contents.into_unknown(), map])
        },
        |env, return_value| {
          let result = env.from_js_value::<JsTransformerResult, _>(return_value)?;
          Ok(result)
        },
      )
      .await?;

    let mut assets_iter = result.assets.into_iter();
    let first_asset = assets_iter
      .next()
      .ok_or_else(|| anyhow::Error::msg("Transformer returned no assets"))?;

    let convert_asset = |js_asset: JsTransformerAsset| -> Result<Asset, Error> {
      let code = Code::from(js_asset.code);
      let map = if let Some(json) = js_asset.map {
        Some(SourceMap::from_json(
          &self.plugin_options.project_root,
          &json,
        )?)
      } else {
        None
      };

      Ok(Asset {
        id: js_asset.id,
        code,
        bundle_behavior: js_asset.bundle_behavior,
        env: asset_env.clone(),
        file_path: js_asset.file_path,
        file_type: js_asset.file_type,
        map,
        meta: js_asset.meta,
        pipeline: js_asset.pipeline,
        query: js_asset.query,
        stats: stats.clone(),
        symbols: js_asset.symbols,
        unique_key: js_asset.unique_key,
        side_effects: js_asset.side_effects,
        is_bundle_splittable: js_asset.is_bundle_splittable,
        is_source: js_asset.is_source,
        ..asset.clone()
      })
    };

    let mut transformed_asset = convert_asset(first_asset)?;
    if transformed_asset.map.is_none() {
      transformed_asset.map = original_source_map;
    }

    let mut discovered_assets = Vec::new();
    for js_asset in assets_iter {
      let asset = convert_asset(js_asset)?;
      discovered_assets.push(AssetWithDependencies {
        asset,
        dependencies: vec![],
      });
    }

    Ok(TransformResult {
      asset: transformed_asset,
      discovered_assets,
      invalidate_on_file_change: result
        .invalidate_on_file_change
        .into_iter()
        .map(PathBuf::from)
        .collect(),
      ..Default::default()
    })
  }
}

/// This Asset mostly replicates the core Asset type however it only features
/// fields that can be modified by transformers
#[derive(PartialEq, Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JsTransformerAsset {
  pub id: String,
  pub bundle_behavior: Option<BundleBehavior>,
  pub file_path: PathBuf,
  #[serde(rename = "type")]
  pub file_type: FileType,
  pub code: String,
  pub map: Option<String>,
  pub meta: JSONObject,
  pub pipeline: Option<String>,
  pub query: Option<String>,
  pub symbols: Option<Vec<Symbol>>,
  pub unique_key: Option<String>,
  pub side_effects: bool,
  pub is_bundle_splittable: bool,
  pub is_source: bool,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct JsTransformerResult {
  assets: Vec<JsTransformerAsset>,
  #[allow(dead_code)]
  #[serde(default)]
  invalidate_on_file_create: Vec<InvalidateOnFileCreate>,
  #[serde(default)]
  invalidate_on_file_change: Vec<String>,
  #[allow(dead_code)]
  #[serde(default)]
  invalidate_on_env_change: Vec<String>,
}

// This Environment mostly replicates the core Environment but makes everything
// optional as it is merged into the Asset Environment later.
// Similar to packages/core/types-internal/src/index.js#EnvironmnetOptions
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcEnvironmentResult {
  pub context: Option<EnvironmentContext>,
  pub engines: Option<Engines>,
  pub include_node_modules: Option<IncludeNodeModules>,
  pub is_library: Option<bool>,
  pub loc: Option<SourceLocation>,
  pub output_format: Option<OutputFormat>,
  pub should_scope_hoist: Option<bool>,
  pub should_optimize: Option<bool>,
  pub source_type: Option<SourceType>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcTransformerOpts {
  pub key: String,
  pub options: RpcPluginOptions,
  pub env: Arc<Environment>,
  pub asset: Asset,
}
