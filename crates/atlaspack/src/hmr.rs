use anyhow::Context;
use atlaspack_core::types::{Asset, Diagnostic};
use futures::SinkExt;
use serde::Serialize;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio::sync::broadcast;

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HmrMessage {
  Update { assets: Vec<Asset> },
  Error { diagnostics: Vec<Diagnostic> },
}

pub struct HmrServer {
  port: u16,
  tx: broadcast::Sender<HmrMessage>,
}

impl HmrServer {
  pub fn new(port: u16) -> Self {
    let (tx, _) = broadcast::channel(16);
    Self { port, tx }
  }

  pub fn start(&self) -> Result<(), anyhow::Error> {
    let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
    let std_listener = std::net::TcpListener::bind(addr).context("Failed to bind HMR port")?;
    std_listener.set_nonblocking(true)?;

    let listener = TcpListener::from_std(std_listener)?;
    let tx = self.tx.clone();

    tokio::spawn(async move {
      tracing::info!("HMR server listening on {}", addr);

      while let Ok((stream, _)) = listener.accept().await {
        let mut rx = tx.subscribe();

        tokio::spawn(async move {
          let mut ws_stream = match tokio_tungstenite::accept_async(stream).await {
            Ok(ws) => ws,
            Err(e) => {
              tracing::error!("Error during the websocket handshake: {}", e);
              return;
            }
          };

          loop {
            match rx.recv().await {
              Ok(msg) => {
                let json = match serde_json::to_string(&msg) {
                  Ok(j) => j,
                  Err(e) => {
                    tracing::error!("Failed to serialize HMR message: {}", e);
                    continue;
                  }
                };

                if let Err(_e) = ws_stream
                  .send(tokio_tungstenite::tungstenite::Message::Text(json))
                  .await
                {
                  // Client disconnected or error
                  break;
                }
              }
              Err(broadcast::error::RecvError::Lagged(_)) => {
                // We missed some messages. ideally we'd trigger a full reload here.
                continue;
              }
              Err(broadcast::error::RecvError::Closed) => {
                break;
              }
            }
          }
        });
      }
    });

    Ok(())
  }

  pub fn broadcast(&self, message: HmrMessage) {
    // We ignore the error if there are no subscribers
    let _ = self.tx.send(message);
  }
}
