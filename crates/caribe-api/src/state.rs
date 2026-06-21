//! Shared application state injected into handlers via `axum::extract::State`.

use caribe_core::Db;

/// Cheap-to-clone handle to everything a request handler needs.
#[derive(Clone)]
pub struct AppState {
    /// The MongoDB repository facade.
    pub db: Db,
}
