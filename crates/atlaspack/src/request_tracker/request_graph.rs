use std::path::PathBuf;
use std::sync::Arc;

use petgraph::stable_graph::StableDiGraph;

use crate::{request_tracker::RunRequestError, requests::RequestResult};

pub type RequestGraph = StableDiGraph<RequestNode, RequestEdgeType>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GlobNode {
  pub glob: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileNameNode {
  pub file_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileNode {
  pub path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnvNode {
  pub key: String,
  pub value: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OptionNode {
  pub key: String,
  pub hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigKeyNode {
  pub path: PathBuf,
  pub config_key: String,
  pub hash: String,
}

#[derive(Debug)]
#[allow(clippy::large_enum_variant)]
pub enum RequestState {
  Error(RunRequestError),
  Incomplete(Option<Arc<RequestResult>>),
  Valid(Arc<RequestResult>),
  Invalid(Option<Arc<RequestResult>>),
}

#[derive(Debug)]
#[allow(clippy::large_enum_variant)]
pub enum RequestNode {
  Root,
  Request(RequestState),
  Glob(GlobNode),
  FileName(FileNameNode),
  File(FileNode),
  Env(EnvNode),
  Option(OptionNode),
  ConfigKey(ConfigKeyNode),
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum RequestEdgeType {
  SubRequest,
  InvalidatedByUpdate,
  InvalidatedByCreate,
  InvalidatedByDelete,
  InvalidatedByCreateAbove,
  Dirname,
}
