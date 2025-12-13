use std::path::PathBuf;

use serde::Deserialize;

#[derive(Debug, PartialEq, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InternalFileCreateInvalidation {
  pub glob: Option<String>,
  pub file_name: Option<String>,
  pub above_file_path: Option<PathBuf>,
  pub file_path: Option<PathBuf>,
}

#[derive(Debug, PartialEq, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Invalidation {
  FileChange(PathBuf),
  FileCreate(InternalFileCreateInvalidation),
  FileUpdate(PathBuf),
  FileDelete(PathBuf),
  EnvChange {
    key: String,
    value: Option<String>,
  },
  OptionChange {
    key: String,
    hash: String,
  },
  ConfigKeyChange {
    file_path: PathBuf,
    config_key: String,
    content_hash: String,
  },
}
