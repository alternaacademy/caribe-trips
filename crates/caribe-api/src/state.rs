//! Shared application state injected into handlers via `axum::extract::State`.

use std::sync::Arc;

use caribe_core::Db;

use crate::config::Config;

/// Cheap-to-clone handle to everything a request handler needs.
#[derive(Clone)]
pub struct AppState {
    /// The MongoDB repository facade.
    pub db: Db,
    /// Runtime configuration (the concierge handler reads the Ollama settings).
    pub config: Arc<Config>,
}
