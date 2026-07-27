//! One JSON object per line on stdout, for log shipping.
//!
//! Privacy: no passwords, tokens, phone numbers, names or full addresses ever
//! reach this module. `usuario` is a truncated SHA-256 of the email — stable
//! enough to follow one traveler across events, useless for identifying them.

use std::fmt;

use serde::Serialize;
use sha2::{Digest, Sha256};

/// Outcome of the operation being recorded.
#[derive(Debug, Clone, Copy)]
pub enum Estado {
    Ok,
    Error,
}

impl fmt::Display for Estado {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Estado::Ok => write!(f, "ok"),
            Estado::Error => write!(f, "error"),
        }
    }
}

#[derive(Serialize)]
struct Line<'a> {
    evento: &'a str,
    hora: String,
    usuario: &'a str,
    duracion_ms: u64,
    estado: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    detalle: Option<&'a str>,
}

/// Pseudonymous, stable id for a traveler. Never reversible to the address.
#[must_use]
pub fn usuario_hash(email: &str) -> String {
    let digest = Sha256::digest(email.trim().to_lowercase().as_bytes());
    format!("u_{:x}", digest)[..14].to_string()
}

/// Used when there is no identified traveler, e.g. concierge queries.
pub const ANONIMO: &str = "anonimo";

/// Write one event line to stdout.
///
/// Deliberately `println!` rather than `tracing`: these lines are a stable
/// machine contract for Filebeat, so they must not inherit the human log's
/// formatting, level filtering or `RUST_LOG` gating.
pub fn emit(evento: &str, usuario: &str, duracion_ms: u64, estado: Estado, detalle: Option<&str>) {
    let line = Line {
        evento,
        hora: chrono::Utc::now().to_rfc3339(),
        usuario,
        duracion_ms,
        estado: estado.to_string(),
        detalle,
    };
    match serde_json::to_string(&line) {
        Ok(json) => println!("{json}"),
        // Never let telemetry break a request.
        Err(e) => tracing::warn!(%e, "could not serialize event"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usuario_hash_is_stable_and_case_insensitive() {
        let a = usuario_hash("Cliente@Test.do");
        let b = usuario_hash("  cliente@test.do ");
        assert_eq!(a, b);
        assert!(a.starts_with("u_"));
    }

    /// The whole point: the address must not be recoverable from the log.
    #[test]
    fn usuario_hash_leaks_no_part_of_the_address() {
        let hash = usuario_hash("cliente@test.do");
        assert!(!hash.contains("cliente"));
        assert!(!hash.contains("test.do"));
        assert!(!hash.contains('@'));
    }

    #[test]
    fn different_addresses_get_different_ids() {
        assert_ne!(usuario_hash("a@test.do"), usuario_hash("b@test.do"));
    }
}
