use std::io::Read;

use anyhow::Error;
use async_trait::async_trait;
use atlaspack_core::plugin::{OptimizeContext, OptimizedBundle, OptimizerPlugin};
use atlaspack_image::optimize;

#[derive(Debug)]
pub struct AtlaspackImageOptimizerPlugin;

#[async_trait]
impl OptimizerPlugin for AtlaspackImageOptimizerPlugin {
  async fn optimize<'a>(&self, ctx: OptimizeContext<'a>) -> Result<OptimizedBundle, Error> {
    let mut contents = Vec::new();
    // Read contents from file
    (&*ctx.contents).read_to_end(&mut contents)?;

    // Check if we should optimize
    if !ctx.bundle.env.should_optimize {
      return Ok(OptimizedBundle {
        contents,
        map: None,
      });
    }

    let ext = ctx.bundle.bundle_type.extension();
    // Only optimize known types
    let optimized_contents = match ext {
      "png" | "jpg" | "jpeg" => optimize(ext, &contents)?,
      _ => contents,
    };

    Ok(OptimizedBundle {
      contents: optimized_contents,
      map: None,
    })
  }
}
