use std::collections::HashMap;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::mpsc::Sender;

use atlaspack_core::types::InternalFileCreateInvalidation;
use atlaspack_core::types::Invalidation;
use glob_match::glob_match;
use lmdb_js_lite::DatabaseHandle;
use petgraph::graph::NodeIndex;
use petgraph::stable_graph::StableDiGraph;

use atlaspack_core::config_loader::ConfigLoaderRef;
use atlaspack_core::diagnostic_error;
use atlaspack_core::types::AtlaspackOptions;
use atlaspack_filesystem::FileSystemRef;
use petgraph::Direction;
use petgraph::visit::Dfs;
use petgraph::visit::EdgeRef;
use petgraph::visit::Reversed;

use crate::AtlaspackError;
use crate::WatchEvent;
use crate::WatchEvents;
use crate::plugins::PluginsRef;
use crate::request_tracker::RequestResultSender;
use crate::requests::RequestResult;

use super::ConfigKeyNode;
use super::EnvNode;
use super::FileNameNode;
use super::FileNode;
use super::GlobNode;
use super::OptionNode;
use super::Request;

use super::RequestEdgeType;
use super::RequestGraph;
use super::RequestId;
use super::RequestNode;
use super::RequestState;
use super::ResultAndInvalidations;
use super::RunRequestError;
use super::{RunRequestContext, RunRequestMessage};

/// [`RequestTracker`] runs atlaspack work items and constructs a graph of their dependencies.
///
/// Whenever a [`Request`] implementation needs to get the result of another piece of work, it'll
/// make a call into [`RequestTracker`] through its [`RunRequestContext`] abstraction. The request
/// tracker will verify if the piece of work has been completed and return its result. If the work
/// has not been seen yet, it'll be scheduled for execution.
///
/// By asking for the result of a piece of work (through [`RunRequestContext::queue_request`]) a
/// request is creating an edge between itself and that sub-request.
///
/// This will be used to trigger cache invalidations.
pub struct RequestTracker {
  config_loader: ConfigLoaderRef,
  file_system: FileSystemRef,
  graph: RequestGraph,
  options: Arc<AtlaspackOptions>,
  plugins: PluginsRef,
  project_root: PathBuf,
  request_index: HashMap<u64, NodeIndex>,
  invalidations: HashMap<PathBuf, NodeIndex>,
  invalid_nodes: HashSet<NodeIndex>,
  glob_nodes: HashMap<String, NodeIndex>,
  env_nodes: HashMap<String, NodeIndex>,
  option_nodes: HashMap<String, NodeIndex>,
  file_name_nodes: HashMap<String, NodeIndex>,
  config_key_nodes: HashMap<PathBuf, HashSet<NodeIndex>>,
  db: Arc<DatabaseHandle>,
}

impl RequestTracker {
  pub fn new(
    config_loader: ConfigLoaderRef,
    file_system: FileSystemRef,
    options: Arc<AtlaspackOptions>,
    plugins: PluginsRef,
    project_root: PathBuf,
    db: Arc<DatabaseHandle>,
  ) -> Self {
    let mut graph = StableDiGraph::<RequestNode, RequestEdgeType>::new();

    graph.add_node(RequestNode::Root);

    RequestTracker {
      config_loader,
      file_system,
      graph,
      plugins,
      project_root,
      request_index: HashMap::new(),
      invalidations: HashMap::new(),
      invalid_nodes: HashSet::new(),
      options,
      glob_nodes: HashMap::new(),
      env_nodes: HashMap::new(),
      option_nodes: HashMap::new(),
      file_name_nodes: HashMap::new(),
      config_key_nodes: HashMap::new(),
      db,
    }
  }

  /// Run a request that has no parent. Return the result.
  ///
  /// ## Multi-threading
  /// Sub-requests may be queued from this initial `request` using
  /// [`RunRequestContext::queue_request`].
  /// All sub-requests will run on separate tasks on a thread-pool.
  ///
  /// A request may use the channel passed into  [`RunRequestContext::queue_request`] to wait for
  /// results from sub-requests.
  ///
  /// Because threads will be blocked by waiting on sub-requests, the system may stall if the thread
  /// pool runs out of threads. For the same reason, the number of threads must always be greater
  /// than 1. For this reason the minimum number of threads our thread-pool uses is 4.
  ///
  /// There are multiple ways we can fix this in our implementation:
  /// * Use async, so we get cooperative multi-threading and don't need to worry about this
  /// * Whenever we block a thread, block using recv_timeout and then use [`rayon::yield_now`] so
  ///   other tasks get a chance to tick on our thread-pool. This is a very poor implementation of
  ///   the cooperative threading behaviours async will grant us.
  /// * Don't use rayon for multi-threading here and use a custom thread-pool implementation which
  ///   ensures we always have more threads than concurrently running requests
  /// * Run requests that need to spawn multithreaded sub-requests on the main-thread
  ///   - That is, introduce a new `MainThreadRequest` trait, which is able to enqueue requests,
  ///     these will run on the main-thread, therefore it'll be simpler to implement queueing
  ///     without stalls and locks/channels
  ///   - For non-main-thread requests, do not allow enqueueing of sub-requests
  fn add_node(&mut self, node: RequestNode) -> NodeIndex {
    match node {
      RequestNode::Request(_) => {
        // Handled via request_index usually, but if added directly:
        self.graph.add_node(node)
      }
      RequestNode::File(ref file_node) => {
        if let Some(index) = self.invalidations.get(&file_node.path) {
          return *index;
        }
        let index = self.graph.add_node(RequestNode::File(file_node.clone()));
        self.invalidations.insert(file_node.path.clone(), index);
        index
      }
      RequestNode::FileName(ref file_name_node) => {
        if let Some(index) = self.file_name_nodes.get(&file_name_node.file_name) {
          return *index;
        }
        let index = self
          .graph
          .add_node(RequestNode::FileName(file_name_node.clone()));
        self
          .file_name_nodes
          .insert(file_name_node.file_name.clone(), index);
        index
      }
      RequestNode::Glob(ref glob_node) => {
        if let Some(index) = self.glob_nodes.get(&glob_node.glob) {
          return *index;
        }
        let index = self.graph.add_node(RequestNode::Glob(glob_node.clone()));
        self.glob_nodes.insert(glob_node.glob.clone(), index);
        index
      }
      RequestNode::Env(ref env_node) => {
        if let Some(index) = self.env_nodes.get(&env_node.key) {
          return *index;
        }
        let index = self.graph.add_node(RequestNode::Env(env_node.clone()));
        self.env_nodes.insert(env_node.key.clone(), index);
        index
      }
      RequestNode::Option(ref option_node) => {
        if let Some(index) = self.option_nodes.get(&option_node.key) {
          return *index;
        }
        let index = self
          .graph
          .add_node(RequestNode::Option(option_node.clone()));
        self.option_nodes.insert(option_node.key.clone(), index);
        index
      }
      RequestNode::ConfigKey(ref config_key_node) => {
        if let Some(nodes) = self.config_key_nodes.get(&config_key_node.path) {
          for &index in nodes {
            if let RequestNode::ConfigKey(ref existing) = self.graph[index] {
              if existing.config_key == config_key_node.config_key {
                return index;
              }
            }
          }
        }
        let index = self
          .graph
          .add_node(RequestNode::ConfigKey(config_key_node.clone()));
        self
          .config_key_nodes
          .entry(config_key_node.path.clone())
          .or_default()
          .insert(index);
        index
      }
      RequestNode::Root => NodeIndex::new(0),
    }
  }

  fn has_edge(&self, from: NodeIndex, to: NodeIndex, edge_type: RequestEdgeType) -> bool {
    self
      .graph
      .edges_directed(from, Direction::Outgoing)
      .any(|edge| edge.target() == to && *edge.weight() == edge_type)
  }

  fn invalidate_on_file_create(
    &mut self,
    request_node_id: NodeIndex,
    input: InternalFileCreateInvalidation,
  ) {
    let node_id = if let Some(glob) = input.glob {
      self.add_node(RequestNode::Glob(GlobNode { glob }))
    } else if let (Some(file_name), Some(above_file_path)) =
      (input.file_name, input.above_file_path)
    {
      let parts: Vec<&str> = file_name.split('/').rev().collect();
      let mut last_node_id = None;
      for part in &parts {
        let file_name_node_id = self.add_node(RequestNode::FileName(FileNameNode {
          file_name: part.to_string(),
        }));

        if let Some(last_id) = last_node_id {
          if !self.has_edge(last_id, file_name_node_id, RequestEdgeType::Dirname) {
            self
              .graph
              .add_edge(last_id, file_name_node_id, RequestEdgeType::Dirname);
          }
        }
        last_node_id = Some(file_name_node_id);
      }

      let above_node_id = self.add_node(RequestNode::File(FileNode {
        path: above_file_path,
      }));

      let first_part = parts[0];
      let first_file_name_node_id = self.add_node(RequestNode::FileName(FileNameNode {
        file_name: first_part.to_string(),
      }));

      if !self.has_edge(
        above_node_id,
        first_file_name_node_id,
        RequestEdgeType::InvalidatedByCreateAbove,
      ) {
        self.graph.add_edge(
          above_node_id,
          first_file_name_node_id,
          RequestEdgeType::InvalidatedByCreateAbove,
        );
      }

      let last_node_id = last_node_id.unwrap();
      if !self.has_edge(
        last_node_id,
        above_node_id,
        RequestEdgeType::InvalidatedByCreateAbove,
      ) {
        self.graph.add_edge(
          last_node_id,
          above_node_id,
          RequestEdgeType::InvalidatedByCreateAbove,
        );
      }

      above_node_id
    } else if let Some(file_path) = input.file_path {
      self.add_node(RequestNode::File(FileNode { path: file_path }))
    } else {
      return;
    };

    if !self.has_edge(
      request_node_id,
      node_id,
      RequestEdgeType::InvalidatedByCreate,
    ) {
      self.graph.add_edge(
        request_node_id,
        node_id,
        RequestEdgeType::InvalidatedByCreate,
      );
    }
  }

  fn invalidate_on_file_update(&mut self, request_node_id: NodeIndex, file_path: PathBuf) {
    let node_id = self.add_node(RequestNode::File(FileNode { path: file_path }));
    if !self.has_edge(
      request_node_id,
      node_id,
      RequestEdgeType::InvalidatedByUpdate,
    ) {
      self.graph.add_edge(
        request_node_id,
        node_id,
        RequestEdgeType::InvalidatedByUpdate,
      );
    }
  }

  fn invalidate_on_file_delete(&mut self, request_node_id: NodeIndex, file_path: PathBuf) {
    let node_id = self.add_node(RequestNode::File(FileNode { path: file_path }));
    if !self.has_edge(
      request_node_id,
      node_id,
      RequestEdgeType::InvalidatedByDelete,
    ) {
      self.graph.add_edge(
        request_node_id,
        node_id,
        RequestEdgeType::InvalidatedByDelete,
      );
    }
  }

  fn invalidate_on_env_change(
    &mut self,
    request_node_id: NodeIndex,
    key: String,
    value: Option<String>,
  ) {
    let node_id = self.add_node(RequestNode::Env(EnvNode { key, value }));
    if !self.has_edge(
      request_node_id,
      node_id,
      RequestEdgeType::InvalidatedByUpdate,
    ) {
      self.graph.add_edge(
        request_node_id,
        node_id,
        RequestEdgeType::InvalidatedByUpdate,
      );
    }
  }

  fn invalidate_on_option_change(&mut self, request_node_id: NodeIndex, key: String, hash: String) {
    let node_id = self.add_node(RequestNode::Option(OptionNode { key, hash }));
    if !self.has_edge(
      request_node_id,
      node_id,
      RequestEdgeType::InvalidatedByUpdate,
    ) {
      self.graph.add_edge(
        request_node_id,
        node_id,
        RequestEdgeType::InvalidatedByUpdate,
      );
    }
  }

  fn invalidate_on_config_key_change(
    &mut self,
    request_node_id: NodeIndex,
    file_path: PathBuf,
    config_key: String,
    content_hash: String,
  ) {
    let node_id = self.add_node(RequestNode::ConfigKey(ConfigKeyNode {
      path: file_path,
      config_key,
      hash: content_hash,
    }));
    if !self.has_edge(
      request_node_id,
      node_id,
      RequestEdgeType::InvalidatedByUpdate,
    ) {
      self.graph.add_edge(
        request_node_id,
        node_id,
        RequestEdgeType::InvalidatedByUpdate,
      );
    }
  }

  pub async fn run_request(&mut self, request: impl Request) -> anyhow::Result<Arc<RequestResult>> {
    let request_id = request.id();
    let (tx, rx) = std::sync::mpsc::channel();
    let tx2 = tx.clone();
    let _ = tx.send(RequestQueueMessage::RunRequest {
      tx: tx2,
      message: RunRequestMessage {
        request: Box::new(request),
        parent_request_id: None,
        response_tx: None,
      },
    });
    drop(tx);

    while let Ok(request_queue_message) = rx.recv() {
      match request_queue_message {
        RequestQueueMessage::RunRequest {
          message:
            RunRequestMessage {
              request,
              parent_request_id,
              response_tx,
            },
          tx,
        } => {
          let request_id = request.id();
          tracing::trace!(?request_id, ?parent_request_id, "Run request");

          if let Some(previous_result) = self.prepare_request(request_id)? {
            self.link_request_to_parent(request_id, parent_request_id)?;

            // Cached request
            if let Some(response_tx) = response_tx {
              let _ = response_tx.send(Ok((previous_result, request_id, true)));
            }
            continue;
          }

          // Request needs to be executed
          let context = RunRequestContext::new(
            self.config_loader.clone(),
            self.file_system.clone(),
            self.options.clone(),
            Some(request_id),
            self.plugins.clone(),
            self.project_root.clone(),
            // sub-request run
            Box::new({
              let tx = tx.clone();
              move |message| {
                let tx2 = tx.clone();
                tx.send(RequestQueueMessage::RunRequest { message, tx: tx2 })
                  .unwrap();
              }
            }),
          );

          tokio::spawn({
            let tx = tx.clone();
            async move {
              let result = request.run(context).await;
              let _ = tx.send(RequestQueueMessage::RequestResult {
                request_id,
                parent_request_id,
                result,
                response_tx,
              });
            }
          });
        }
        RequestQueueMessage::RequestResult {
          request_id,
          parent_request_id,
          result,
          response_tx,
        } => {
          tracing::trace!(?request_id, ?parent_request_id, "Request result");
          let result = self.store_request(request_id, result);
          self.link_request_to_parent(request_id, parent_request_id)?;

          if let Some(response_tx) = response_tx {
            let _ = response_tx.send(result.map(|result| (result, request_id, false)));
          }
        }
      }
    }

    self.link_request_to_parent(request_id, None)?;
    self.get_request(request_id)
  }

  pub fn get_invalid_nodes(&self) -> impl Iterator<Item = &RequestNode> {
    self
      .invalid_nodes
      .iter()
      .map(|node_index| &self.graph[*node_index])
  }

  /// Before a request is run, a 'pending' [`RequestNode::Incomplete`] entry is added to the graph.
  fn prepare_request(&mut self, request_id: u64) -> anyhow::Result<Option<Arc<RequestResult>>> {
    let node_index = *self.request_index.entry(request_id).or_insert_with(|| {
      self
        .graph
        .add_node(RequestNode::Request(RequestState::Incomplete(None)))
    });

    let request_node = self
      .graph
      .node_weight_mut(node_index)
      .ok_or_else(|| diagnostic_error!("Failed to find request node"))?;

    // Don't run if already run
    if let RequestNode::Request(RequestState::Valid(previous_result)) = request_node {
      return Ok(Some(previous_result.clone()));
    }

    self.invalid_nodes.remove(&node_index);
    *request_node =
      if let RequestNode::Request(RequestState::Invalid(previous_result)) = request_node {
        RequestNode::Request(RequestState::Incomplete(previous_result.clone()))
      } else {
        RequestNode::Request(RequestState::Incomplete(None))
      };

    self.clear_invalidations(node_index);

    Ok(None)
  }

  /// Cleans up old invalidations before a request is executed
  fn clear_invalidations(&mut self, node_index: NodeIndex) {
    let mut old_invalidations = Vec::new();
    for edge in self.graph.edges_directed(node_index, Direction::Incoming) {
      match edge.weight() {
        RequestEdgeType::InvalidatedByUpdate
        | RequestEdgeType::InvalidatedByCreate
        | RequestEdgeType::InvalidatedByDelete => {
          old_invalidations.push(edge.id());
        }
        _ => {}
      }
    }
    for edge_id in old_invalidations {
      self.graph.remove_edge(edge_id);
    }
  }

  /// Once a request finishes, its result is stored under its [`RequestNode`] entry on the graph
  fn store_request(
    &mut self,
    request_id: u64,
    result: Result<ResultAndInvalidations, RunRequestError>,
  ) -> anyhow::Result<Arc<RequestResult>> {
    let node_index = *self
      .request_index
      .get(&request_id)
      .ok_or_else(|| diagnostic_error!("Failed to find request"))?;

    match result {
      Err(error) => {
        {
          let request_node = self
            .graph
            .node_weight_mut(node_index)
            .ok_or_else(|| diagnostic_error!("Failed to find request"))?;
          *request_node =
            RequestNode::Request(RequestState::Error(AtlaspackError::from(&error).into()));
        }
        self.invalid_nodes.insert(node_index);

        Err(error)
      }
      Ok(result) => {
        let ResultAndInvalidations {
          result,
          invalidations,
        } = result;
        let result = Arc::new(result);

        // Update node with latest result
        {
          let request_node = self
            .graph
            .node_weight_mut(node_index)
            .ok_or_else(|| diagnostic_error!("Failed to find request"))?;
          *request_node = RequestNode::Request(RequestState::Valid(result.clone()));
        }

        for invalidation in invalidations.iter() {
          match invalidation {
            Invalidation::FileChange(file_path) => {
              self.invalidate_on_file_update(node_index, file_path.clone());
            }
            Invalidation::FileCreate(input) => {
              self.invalidate_on_file_create(node_index, input.clone());
            }
            Invalidation::FileUpdate(file_path) => {
              self.invalidate_on_file_update(node_index, file_path.clone());
            }
            Invalidation::FileDelete(file_path) => {
              self.invalidate_on_file_delete(node_index, file_path.clone());
            }
            Invalidation::EnvChange { key, value } => {
              self.invalidate_on_env_change(node_index, key.clone(), value.clone());
            }
            Invalidation::OptionChange { key, hash } => {
              self.invalidate_on_option_change(node_index, key.clone(), hash.clone());
            }
            Invalidation::ConfigKeyChange {
              file_path,
              config_key,
              content_hash,
            } => {
              self.invalidate_on_config_key_change(
                node_index,
                file_path.clone(),
                config_key.clone(),
                content_hash.clone(),
              );
            }
          }
        }

        Ok(result)
      }
    }
  }

  fn get_request_node(&self, request_id: u64) -> Option<&RequestNode> {
    let node_index = self.request_index.get(&request_id)?;
    self.graph.node_weight(*node_index)
  }

  fn get_request(&self, request_id: u64) -> anyhow::Result<Arc<RequestResult>> {
    match self.get_request_node(request_id) {
      Some(RequestNode::Request(RequestState::Error(error))) => {
        Err(AtlaspackError::from(error).into())
      }
      Some(RequestNode::Request(RequestState::Valid(value))) => Ok(value.clone()),
      _ => Err(diagnostic_error!("No request with result {}", request_id)),
    }
  }

  pub fn get_cached_request_result(&self, request: impl Request) -> Option<Arc<RequestResult>> {
    match self.get_request_node(request.id())? {
      RequestNode::Request(RequestState::Valid(value)) => Some(value.clone()),
      RequestNode::Request(RequestState::Invalid(value)) => value.as_ref().map(|v| v.clone()),
      _ => None,
    }
  }

  /// Create an edge between a parent request and the target request.
  fn link_request_to_parent(
    &mut self,
    request_id: u64,
    parent_request_hash: Option<u64>,
  ) -> anyhow::Result<()> {
    let Some(node_index) = self.request_index.get(&request_id) else {
      return Err(diagnostic_error!("Impossible error"));
    };

    if let Some(parent_request_id) = parent_request_hash {
      let parent_node_index = self
        .request_index
        .get(&parent_request_id)
        .ok_or_else(|| diagnostic_error!("Failed to find requests"))?;

      self
        .graph
        .add_edge(*parent_node_index, *node_index, RequestEdgeType::SubRequest);
    } else {
      self
        .graph
        .add_edge(NodeIndex::new(0), *node_index, RequestEdgeType::SubRequest);
    }
    Ok(())
  }

  fn invalidate_node(&mut self, node_index: &NodeIndex, file_path_reason: &PathBuf) {
    let mut invalid_nodes = Vec::new();
    {
      let reverse_graph = Reversed(&self.graph);
      let mut dfs = Dfs::new(reverse_graph, *node_index);

      while let Some(node_index) = dfs.next(reverse_graph) {
        let node = &self.graph[node_index];

        match node {
          RequestNode::Request(RequestState::Incomplete(_))
          | RequestNode::Request(RequestState::Valid(_)) => {
            invalid_nodes.push(node_index);
          }
          // Ignore the following node types
          RequestNode::Root => {}
          RequestNode::FileName(_) => {}
          RequestNode::File(_) => {}
          RequestNode::Glob(_) => {}
          RequestNode::Env(_) => {}
          RequestNode::Option(_) => {}
          RequestNode::ConfigKey(_) => {}
          RequestNode::Request(RequestState::Error(_)) => {}
          RequestNode::Request(RequestState::Invalid(_)) => {}
        }
      }
    }

    for invalid_node in invalid_nodes {
      self.graph[invalid_node] = match &self.graph[invalid_node] {
        RequestNode::Request(RequestState::Valid(result)) => {
          tracing::info!("{:?} invalidates {}", file_path_reason, result);

          RequestNode::Request(RequestState::Invalid(Some(result.clone())))
        }
        RequestNode::Request(RequestState::Incomplete(result)) => {
          RequestNode::Request(RequestState::Invalid(result.clone()))
        }
        _ => {
          panic!("Impossible node type")
        }
      };
      self.invalid_nodes.insert(invalid_node);
    }
  }

  fn collect_connected_nodes<'a>(
    &self,
    node_index: NodeIndex,
    edge_type: RequestEdgeType,
    acc: &mut HashSet<(NodeIndex, &'a PathBuf)>,
    reason: &'a PathBuf,
  ) {
    for edge in self.graph.edges_directed(node_index, Direction::Incoming) {
      if *edge.weight() == edge_type {
        acc.insert((edge.source(), reason));
      }
    }
  }

  fn invalidate_file_name_node<'a>(
    &self,
    file_name_node_index: NodeIndex,
    current_path: &std::path::Path,
    reason: &'a PathBuf,
    acc: &mut HashSet<(NodeIndex, &'a PathBuf)>,
  ) {
    let mut current_dir = current_path.parent();

    while let Some(dir) = current_dir {
      if let Some(&dir_node_index) = self.invalidations.get(dir) {
        if !self.has_edge(
          file_name_node_index,
          dir_node_index,
          RequestEdgeType::InvalidatedByCreateAbove,
        ) {
          break;
        }

        self.collect_connected_nodes(
          dir_node_index,
          RequestEdgeType::InvalidatedByCreate,
          acc,
          reason,
        );
      } else {
        break;
      }
      current_dir = dir.parent();
    }

    if let Some(parent) = current_path.parent() {
      if let Some(file_name) = parent.file_name() {
        if let Some(&parent_name_node) = self
          .file_name_nodes
          .get(file_name.to_string_lossy().as_ref())
        {
          if self.has_edge(
            file_name_node_index,
            parent_name_node,
            RequestEdgeType::Dirname,
          ) {
            self.invalidate_file_name_node(parent_name_node, parent, reason, acc);
          }
        }
      }
    }
  }

  #[tracing::instrument(level = "debug", skip_all, ret, fields(events = watch_events.len()))]
  pub fn respond_to_fs_events(&mut self, watch_events: WatchEvents) -> bool {
    let mut nodes_to_invalidate = HashSet::new();

    for event in watch_events.iter() {
      let path = match event {
        WatchEvent::Create(p) | WatchEvent::Update(p) | WatchEvent::Delete(p) => p,
      };

      if let Some(nodes) = self.config_key_nodes.get(path) {
        for &node_index in nodes {
          // TODO: Check config key hash
          self.collect_connected_nodes(
            node_index,
            RequestEdgeType::InvalidatedByUpdate,
            &mut nodes_to_invalidate,
            path,
          );
        }
      }

      match event {
        WatchEvent::Create(path) => {
          let path_str = path.to_string_lossy();
          for (glob, &node_index) in &self.glob_nodes {
            if glob_match(glob, &path_str) {
              self.collect_connected_nodes(
                node_index,
                RequestEdgeType::InvalidatedByCreate,
                &mut nodes_to_invalidate,
                path,
              );
            }
          }

          if let Some(file_name) = path.file_name() {
            if let Some(&node_index) = self
              .file_name_nodes
              .get(file_name.to_string_lossy().as_ref())
            {
              self.invalidate_file_name_node(node_index, path, path, &mut nodes_to_invalidate);
            }
          }

          if let Some(&node_index) = self.invalidations.get(path) {
            self.collect_connected_nodes(
              node_index,
              RequestEdgeType::InvalidatedByUpdate,
              &mut nodes_to_invalidate,
              path,
            );
            self.collect_connected_nodes(
              node_index,
              RequestEdgeType::InvalidatedByCreate,
              &mut nodes_to_invalidate,
              path,
            );
          }
        }
        WatchEvent::Update(path) => {
          if let Some(&node_index) = self.invalidations.get(path) {
            self.collect_connected_nodes(
              node_index,
              RequestEdgeType::InvalidatedByUpdate,
              &mut nodes_to_invalidate,
              path,
            );
          }
        }
        WatchEvent::Delete(path) => {
          if let Some(&node_index) = self.invalidations.get(path) {
            self.collect_connected_nodes(
              node_index,
              RequestEdgeType::InvalidatedByDelete,
              &mut nodes_to_invalidate,
              path,
            );
          }
        }
      }
    }

    for (node_index, reason) in nodes_to_invalidate {
      self.invalidate_node(&node_index, reason);
    }

    tracing::debug!(
      "Invalid nodes {:#?}",
      self
        .invalid_nodes
        .iter()
        .map(|node_id| &self.graph[*node_id])
    );

    !self.invalid_nodes.is_empty()
  }

  pub fn write_to_cache(&self) -> anyhow::Result<()> {
    let request_graph_key = "rust_request_graph";
    let serialized = serde_json::to_vec(&(&self.graph, &self.request_index))?;

    let mut txn = self.db.database().write_txn()?;
    self
      .db
      .database()
      .put(&mut txn, request_graph_key, &serialized)?;
    txn.commit()?;
    Ok(())
  }

  pub fn load_from_cache(
    config_loader: ConfigLoaderRef,
    file_system: FileSystemRef,
    options: Arc<AtlaspackOptions>,
    plugins: PluginsRef,
    project_root: PathBuf,
    db: Arc<DatabaseHandle>,
  ) -> anyhow::Result<Self> {
    let request_graph_key = "rust_request_graph";

    let (graph, request_index) = {
      if options.should_disable_cache {
        let mut graph = StableDiGraph::<RequestNode, RequestEdgeType>::new();
        graph.add_node(RequestNode::Root);
        (graph, HashMap::new())
      } else {
        let txn = db.database().read_txn()?;
        if let Some(cached) = db.database().get(&txn, request_graph_key)? {
          let (graph, request_index): (RequestGraph, HashMap<u64, NodeIndex>) =
            serde_json::from_slice(&cached)?;
          (graph, request_index)
        } else {
          let mut graph = StableDiGraph::<RequestNode, RequestEdgeType>::new();
          graph.add_node(RequestNode::Root);
          (graph, HashMap::new())
        }
      }
    };

    let mut invalidations = HashMap::new();

    let mut glob_nodes = HashMap::new();
    let mut env_nodes = HashMap::new();
    let mut option_nodes = HashMap::new();
    let mut file_name_nodes = HashMap::new();
    let mut config_key_nodes: HashMap<PathBuf, HashSet<NodeIndex>> = HashMap::new();

    // Rebuild indices
    for node_index in graph.node_indices() {
      match &graph[node_index] {
        RequestNode::File(node) => {
          invalidations.insert(node.path.clone(), node_index);
        }
        RequestNode::Glob(node) => {
          glob_nodes.insert(node.glob.clone(), node_index);
        }
        RequestNode::Env(node) => {
          env_nodes.insert(node.key.clone(), node_index);
        }
        RequestNode::Option(node) => {
          option_nodes.insert(node.key.clone(), node_index);
        }
        RequestNode::FileName(node) => {
          file_name_nodes.insert(node.file_name.clone(), node_index);
        }
        RequestNode::ConfigKey(node) => {
          config_key_nodes
            .entry(node.path.clone())
            .or_default()
            .insert(node_index);
        }
        _ => {}
      }
    }

    Ok(RequestTracker {
      config_loader,
      file_system,
      graph,
      plugins,
      project_root,
      request_index,
      invalidations,
      invalid_nodes: HashSet::new(),
      options,
      glob_nodes,
      env_nodes,
      option_nodes,
      file_name_nodes,
      config_key_nodes,
      db,
    })
  }
}

/// Internally, [`RequestTracker`] ticks a queue of work related to each 'entry request' ran.
///
/// This enum represents messages that can be sent to the main-thread that is ticking the work for
/// an entry from worker threads that are processing individual requests.
///
/// See [`RequestTracker::run_request`].
#[derive(Debug)]
#[allow(clippy::large_enum_variant)]
enum RequestQueueMessage {
  RunRequest {
    tx: Sender<RequestQueueMessage>,
    message: RunRequestMessage,
  },
  RequestResult {
    request_id: RequestId,
    parent_request_id: Option<RequestId>,
    result: Result<ResultAndInvalidations, RunRequestError>,
    response_tx: Option<RequestResultSender>,
  },
}
