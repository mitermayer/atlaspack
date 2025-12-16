use anyhow::Result;
use async_trait::async_trait;
use atlaspack_core::asset_graph::AssetGraph;
use atlaspack_core::bundle_graph::BundleGraph;
use atlaspack_core::plugin::BundlerPlugin;
use atlaspack_core::types::AtlaspackOptions;

mod decorate_legacy_graph;
mod ideal_graph;

#[derive(Debug, Default)]
pub struct DefaultBundler;

#[async_trait]
impl BundlerPlugin for DefaultBundler {
  async fn bundle(&self, _bundle_graph: &mut BundleGraph, _asset_graph: &AssetGraph) -> Result<()> {
    // TODO: Pass actual options from PluginContext
    let options = AtlaspackOptions::default();
    let ideal_graph = ideal_graph::create_ideal_graph(_asset_graph, &options);
    decorate_legacy_graph::decorate_legacy_graph(&ideal_graph, _asset_graph, _bundle_graph);
    Ok(())
  }

  async fn optimize(
    &self,
    _bundle_graph: &mut BundleGraph,
    _asset_graph: &AssetGraph,
  ) -> Result<()> {
    Ok(())
  }
}
