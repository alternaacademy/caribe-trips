//! Router construction: health endpoint, the `/api` mount point for resource
//! routes (filled by Tasks 07/08), plus CORS, tracing, and a uniform 404.

use axum::http::{header, HeaderValue, Method};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::error::ApiError;
use crate::routes;
use crate::state::AppState;

/// Build the full application router for `state`, applying CORS (from `config`),
/// request tracing, and a JSON-envelope fallback.
pub fn router(state: AppState, config: &Config) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .merge(routes::packages::routes())
        .merge(routes::bookings::routes());

    Router::new()
        .nest("/api", api)
        .fallback(not_found)
        .layer(cors_layer(config))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// `GET /api/health` → `200 {"status":"ok"}`.
async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

/// Any unmatched route returns the standard error envelope (404).
async fn not_found() -> impl IntoResponse {
    ApiError::NotFound.into_response()
}

/// CORS allowing the configured browser origins and the REST verbs we use.
fn cors_layer(config: &Config) -> CorsLayer {
    let origins: Vec<HeaderValue> = config
        .allowed_origins()
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE])
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    async fn body_string(resp: axum::response::Response) -> String {
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        String::from_utf8(bytes.to_vec()).unwrap()
    }

    /// Health + the 404 envelope. These routes don't read state, so the test
    /// builds them directly without a database.
    #[tokio::test]
    async fn health_and_404_envelope() {
        let app: Router = Router::new()
            .route("/api/health", get(health))
            .fallback(not_found);

        let ok = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(ok.status(), StatusCode::OK);
        assert_eq!(body_string(ok).await, r#"{"status":"ok"}"#);

        let missing = app
            .oneshot(
                Request::builder()
                    .uri("/api/nope")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(missing.status(), StatusCode::NOT_FOUND);
        let body = body_string(missing).await;
        assert!(body.contains(r#""code":"not_found""#), "got {body}");
        assert!(body.contains(r#""error""#), "got {body}");
    }
}
