//! Caribe Trips API library: router, config, state, and error types.
//!
//! Exposed as a library so integration tests (Task 09) can build the router and
//! drive it via `tower`'s `oneshot` without binding a socket. The `caribe-api`
//! binary (`main.rs`) is a thin wrapper over this.

pub mod app;
pub mod concierge;
pub mod config;
pub mod error;
pub mod routes;
pub mod state;
