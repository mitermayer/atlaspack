use anyhow::Error;
use async_trait::async_trait;
use atlaspack_core::plugin::{OptimizeContext, OptimizedBundle, OptimizerPlugin};
use swc_core::common::source_map::SourceMap;
use swc_core::common::{FileName, GLOBALS, Globals, Mark, sync::Lrc};
use swc_core::ecma::codegen::text_writer::JsWriter;
use swc_core::ecma::codegen::{Config, Emitter};
use swc_core::ecma::minifier::optimize;
use swc_core::ecma::minifier::option::{
  CompressOptions, ExtraOptions, MangleOptions, MinifyOptions,
};
use swc_core::ecma::parser::{EsSyntax, Parser, StringInput, Syntax};
use swc_core::ecma::transforms::base::fixer::fixer;
use swc_core::ecma::transforms::base::resolver;
use swc_core::ecma::visit::VisitMutWith;

#[derive(Debug)]
pub struct SwcOptimizer;

#[async_trait]
impl OptimizerPlugin for SwcOptimizer {
  async fn optimize<'a>(&self, ctx: OptimizeContext<'a>) -> Result<OptimizedBundle, Error> {
    if !ctx.bundle.env.should_optimize {
      let mut contents = Vec::new();
      use std::io::Read;
      (&*ctx.contents).read_to_end(&mut contents)?;

      return Ok(OptimizedBundle {
        contents,
        map: ctx.map.cloned(),
      });
    }

    let mut code = String::new();
    {
      use std::io::Read;
      (&*ctx.contents).read_to_string(&mut code)?;
    }

    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(FileName::Anon.into(), code);

    let globals = Globals::new();
    let result = GLOBALS.set(&globals, || {
      let syntax = Syntax::Es(EsSyntax {
        jsx: true,
        ..Default::default()
      });

      let mut parser = Parser::new(syntax, StringInput::from(&*fm), None);
      let program = parser
        .parse_program()
        .map_err(|e| anyhow::anyhow!("Failed to parse JS: {:?}", e))?;

      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();

      let mut program = program;
      program.visit_mut_with(&mut resolver(unresolved_mark, top_level_mark, false));

      let program = optimize(
        program,
        cm.clone(),
        None,
        None,
        &MinifyOptions {
          compress: Some(CompressOptions::default()),
          mangle: Some(MangleOptions::default()),
          ..Default::default()
        },
        &ExtraOptions {
          unresolved_mark,
          top_level_mark,
          mangle_name_cache: None,
        },
      );

      let mut program = program;
      program.visit_mut_with(&mut fixer(None));

      let mut buf = vec![];
      let mut src_map_buf = vec![];

      {
        let writer = JsWriter::new(cm.clone(), "\n", &mut buf, Some(&mut src_map_buf));
        let mut emitter = Emitter {
          cfg: Config::default(),
          cm: cm.clone(),
          comments: None,
          wr: writer,
        };

        emitter.emit_program(&program)?;
      }

      Ok::<
        (
          Vec<u8>,
          Vec<(swc_core::common::BytePos, swc_core::common::LineCol)>,
        ),
        Error,
      >((buf, src_map_buf))
    })?;

    Ok(OptimizedBundle {
      contents: result.0,
      map: None, // TODO: Source map support
    })
  }
}
