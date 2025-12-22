use napi::Env;
use napi::Error;
use napi::JsBuffer;
use napi::Result;
use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub fn optimize_image(kind: String, buf: Buffer, env: Env) -> Result<JsBuffer> {
  let slice = buf.as_ref();
  match atlaspack_image::optimize(&kind, slice) {
    Ok(res) => Ok(env.create_buffer_with_data(res)?.into_raw()),
    Err(err) => Err(Error::from_reason(format!("{}", err))),
  }
}
