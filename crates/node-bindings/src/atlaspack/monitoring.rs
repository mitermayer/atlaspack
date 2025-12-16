use atlaspack_monitoring::TraceCallback;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, JsFunction, JsObject};
use napi_derive::napi;
use std::sync::Arc;

struct JsTraceCallback {
  tsfn: ThreadsafeFunction<String, ErrorStrategy::Fatal>,
}

impl std::fmt::Debug for JsTraceCallback {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "JsTraceCallback")
  }
}

impl TraceCallback for JsTraceCallback {
  fn on_event(&self, event: String) {
    self.tsfn
      .call(event, ThreadsafeFunctionCallMode::NonBlocking);
  }
}

#[napi]
pub fn initialize_monitoring(_env: Env, options: Option<JsObject>) -> napi::Result<()> {
  let mut trace_callback: Option<Arc<dyn TraceCallback>> = None;

  if let Some(opts) = options {
    if opts.has_named_property("onTrace")? {
      let func: JsFunction = opts.get_named_property("onTrace")?;
      let tsfn = func.create_threadsafe_function(0, |ctx| {
        ctx.env.create_string_from_std(ctx.value).map(|v| vec![v])
      })?;
      trace_callback = Some(Arc::new(JsTraceCallback { tsfn }));
    }
  }

  let mut monitoring_options = atlaspack_monitoring::MonitoringOptions::from_env()
    .map_err(|err| napi::Error::from_reason(err.to_string()))?;

  monitoring_options.trace_callback = trace_callback;

  atlaspack_monitoring::initialize_monitoring(monitoring_options)
    .map_err(|err| napi::Error::from_reason(err.to_string()))
}

#[napi]
pub fn close_monitoring() {
  atlaspack_monitoring::close_monitoring();
}

#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub fn get_native_memory_stats() -> Option<atlaspack_memory_profiler::NativeMemoryStats> {
  atlaspack_memory_profiler::get_native_memory_stats()
}

#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub fn reset_memory_tracking() {
  atlaspack_memory_profiler::reset_memory_tracking();
}

#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub fn sample_native_memory() {
  atlaspack_memory_profiler::sample_native_memory();
}
