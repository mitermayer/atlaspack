use std::path::PathBuf;
use std::sync::Arc;

use petgraph::stable_graph::StableDiGraph;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

use crate::{request_tracker::RunRequestError, requests::RequestResult};

pub type RequestGraph = StableDiGraph<RequestNode, RequestEdgeType>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GlobNode {
  pub glob: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileNameNode {
  pub file_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileNode {
  pub path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EnvNode {
  pub key: String,
  pub value: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OptionNode {
  pub key: String,
  pub hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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

impl Serialize for RequestState {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    #[derive(Serialize)]
    enum RequestStateVariant<'a> {
      Error(String),
      Incomplete(&'a Option<Arc<RequestResult>>),
      Valid(&'a Arc<RequestResult>),
      Invalid(&'a Option<Arc<RequestResult>>),
    }

    let variant = match self {
      RequestState::Error(e) => RequestStateVariant::Error(e.to_string()),
      RequestState::Incomplete(v) => RequestStateVariant::Incomplete(v),
      RequestState::Valid(v) => RequestStateVariant::Valid(v),
      RequestState::Invalid(v) => RequestStateVariant::Invalid(v),
    };
    variant.serialize(serializer)
  }
}

impl<'de> Deserialize<'de> for RequestState {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    #[derive(Deserialize)]
    enum RequestStateVariant {
      Error(String),
      Incomplete(Option<Arc<RequestResult>>),
      Valid(Arc<RequestResult>),
      Invalid(Option<Arc<RequestResult>>),
    }

    let variant = RequestStateVariant::deserialize(deserializer)?;
    Ok(match variant {
      RequestStateVariant::Error(s) => RequestState::Error(anyhow::anyhow!(s)),
      RequestStateVariant::Incomplete(v) => RequestState::Incomplete(v),
      RequestStateVariant::Valid(v) => RequestState::Valid(v),
      RequestStateVariant::Invalid(v) => RequestState::Invalid(v),
    })
  }
}

#[derive(Debug, Serialize, Deserialize)]
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

#[derive(Debug, PartialEq, Eq, Clone, Copy, Serialize, Deserialize)]
pub enum RequestEdgeType {
  SubRequest,
  InvalidatedByUpdate,
  InvalidatedByCreate,
  InvalidatedByDelete,
  InvalidatedByCreateAbove,
  Dirname,
}
