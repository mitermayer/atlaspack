use std::path::Path;
use std::sync::mpsc::Receiver;
use std::sync::mpsc::channel;

use notify::Event;
use notify::EventKind;
use notify::RecommendedWatcher;
use notify::RecursiveMode;
use notify::Watcher as NotifyWatcher;

use crate::watch::WatchEvent;
use crate::watch::WatchEvents;

pub struct Watcher {
  watcher: RecommendedWatcher,
}

impl Watcher {
  pub fn new(
    error_handler: impl Fn(notify::Error) + Send + 'static,
  ) -> anyhow::Result<(Self, Receiver<WatchEvents>)> {
    let (tx, rx) = channel();

    let watcher =
      notify::recommended_watcher(move |res: Result<Event, notify::Error>| match res {
        Ok(event) => {
          let mut watch_events = Vec::new();
          let kind = event.kind;

          for path in event.paths {
            let watch_event = match kind {
              EventKind::Create(_) => Some(WatchEvent::Create(path)),
              EventKind::Modify(_) => Some(WatchEvent::Update(path)),
              EventKind::Remove(_) => Some(WatchEvent::Delete(path)),
              _ => None,
            };

            if let Some(e) = watch_event {
              watch_events.push(e);
            }
          }

          if !watch_events.is_empty() {
            let _ = tx.send(watch_events);
          }
        }
        Err(e) => error_handler(e),
      })?;

    Ok((Self { watcher }, rx))
  }

  pub fn watch(&mut self, path: &Path) -> anyhow::Result<()> {
    self.watcher.watch(path, RecursiveMode::Recursive)?;
    Ok(())
  }
}
