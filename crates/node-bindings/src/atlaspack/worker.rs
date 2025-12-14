use std::sync::Arc;

use atlaspack::rpc::nodejs::NodejsWorker;
use atlaspack_napi_helpers::JsTransferable;
use napi::bindgen_prelude::ToNapiValue;
use napi::{Env, JsObject, JsUnknown, NapiValue};
use napi_derive::napi;

/*
  Main Thread                       Worker Thread (n)

  Spawns worker threads      -->    Constructs native NodeJsWorker
                             <--    postMessage "ptr"
  Waits for pointers then
  forwards them to napi.
  napi unwraps pointers to
  underlying NodeJsWorker
  then calls methods on it
  during build
*/

/// Called on the worker thread to create a reference to the NodeJs worker
#[napi]
pub fn new_nodejs_worker(env: Env, worker: JsObject) -> napi::Result<JsObject> {
  let worker = NodejsWorker::new(worker)?;
  let worker_arc = Arc::new(worker);

  env.execute_tokio_future(
    async move {
      worker_arc
        .handshake()
        .await
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
      Ok(JsTransferable::new(worker_arc))
    },
    |&mut env, data| unsafe {
      let raw = JsTransferable::to_napi_value(env.raw(), data)?;
      Ok(JsUnknown::from_raw_unchecked(env.raw(), raw))
    },
  )
}
