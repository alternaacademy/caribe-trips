//! The API's single error type and its JSON envelope.
//!
//! Every non-2xx response is `{ "error": { "code", "message" } }` so the
//! frontend (Task 12) can decode failures uniformly.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use caribe_core::{DomainError, RepoError};
use serde_json::json;

/// All the ways an API request can fail.
#[derive(Debug)]
pub enum ApiError {
    /// Input failed domain validation (400).
    Validation(String),
    /// The requested resource does not exist (404).
    NotFound,
    /// The request conflicts with current state, e.g. a duplicate or an
    /// already-confirmed booking (409).
    Conflict(String),
    /// An unexpected server-side failure (500).
    Internal(String),
    /// The AI concierge could not produce a recommendation (503). Deliberately
    /// distinct from `Internal`: the client degrades to browsing rather than
    /// treating it as a bug. The variants map to different copy in the UI, so
    /// a slow model does not read the same as an unplugged one.
    ConciergeUnavailable,
    ConciergeTimeout,
    /// Reached the model, but its answer was unusable (unparseable, or it chose
    /// a package that does not exist).
    ConciergeConfused,
}

impl ApiError {
    /// HTTP status + stable machine `code` for this error.
    fn parts(&self) -> (StatusCode, &'static str) {
        match self {
            ApiError::Validation(_) => (StatusCode::BAD_REQUEST, "validation_error"),
            ApiError::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            ApiError::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            ApiError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
            ApiError::ConciergeUnavailable => {
                (StatusCode::SERVICE_UNAVAILABLE, "concierge_unavailable")
            }
            ApiError::ConciergeTimeout => (StatusCode::GATEWAY_TIMEOUT, "concierge_timeout"),
            ApiError::ConciergeConfused => {
                (StatusCode::SERVICE_UNAVAILABLE, "concierge_confused")
            }
        }
    }

    /// Concierge failures are recorded by their route, with timing.
    fn is_concierge(&self) -> bool {
        matches!(
            self,
            ApiError::ConciergeUnavailable
                | ApiError::ConciergeTimeout
                | ApiError::ConciergeConfused
        )
    }

    fn message(&self) -> String {
        match self {
            ApiError::Validation(m) | ApiError::Conflict(m) | ApiError::Internal(m) => m.clone(),
            ApiError::NotFound => "resource not found".to_string(),
            ApiError::ConciergeUnavailable => {
                "el asesor no está disponible en este momento".to_string()
            }
            ApiError::ConciergeTimeout => "el asesor tardó demasiado en responder".to_string(),
            ApiError::ConciergeConfused => {
                "el asesor no pudo armar una recomendación".to_string()
            }
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = self.parts();
        let message = self.message();
        if status == StatusCode::INTERNAL_SERVER_ERROR {
            tracing::error!(code, %message, "request failed");
        }
        // Single funnel for every API failure. Concierge errors are skipped
        // here because the route already emitted them with a real duration and
        // the specific failure mode; logging them twice would double the counts.
        if !self.is_concierge() {
            // No duration: this is the response boundary, not the operation.
            crate::events::emit(
                "fallo",
                crate::events::ANONIMO,
                0,
                crate::events::Estado::Error,
                Some(code),
            );
        }
        let body = json!({ "error": { "code": code, "message": message } });
        (status, Json(body)).into_response()
    }
}

impl From<DomainError> for ApiError {
    fn from(e: DomainError) -> Self {
        ApiError::Validation(e.to_string())
    }
}

impl From<RepoError> for ApiError {
    fn from(e: RepoError) -> Self {
        match e {
            RepoError::NotFound => ApiError::NotFound,
            RepoError::DuplicateCode | RepoError::AlreadyConfirmed => {
                ApiError::Conflict(e.to_string())
            }
            RepoError::Mongo(_) | RepoError::Bson(_) => ApiError::Internal(e.to_string()),
        }
    }
}

/// Convenient `Result` alias for handlers.
pub type ApiResult<T> = Result<T, ApiError>;
