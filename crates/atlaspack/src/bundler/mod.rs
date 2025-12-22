use atlaspack_core::asset_graph::AssetGraph;
use atlaspack_core::bundle_graph::BundleGraph;

pub mod decorate_legacy_graph;
mod ideal_graph;

pub struct DefaultBundler;

impl DefaultBundler {
  pub fn bundle(graph: &mut BundleGraph, asset_graph: &AssetGraph) -> anyhow::Result<()> {
    let options = atlaspack_core::types::AtlaspackOptions::default(); // TODO: Pass options
    let ideal_graph = ideal_graph::create_ideal_graph(asset_graph, &options);
    decorate_legacy_graph::decorate_legacy_graph(&ideal_graph, asset_graph, graph);
    Ok(())
  }
}
