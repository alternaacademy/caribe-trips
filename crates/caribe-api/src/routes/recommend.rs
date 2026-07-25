//! Concierge resource: free-text intent in, one grounded recommendation out.

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use caribe_core::PackageFilter;
use serde::Deserialize;

use crate::concierge::{self, ConciergeError, Recommendation};
use crate::error::{ApiError, ApiResult};
use crate::state::AppState;

const MAX_INTENT_CHARS: usize = 2000;
/// Below this there isn't enough signal to justify a multi-second call.
const MIN_INTENT_CHARS: usize = 10;

#[derive(Debug, Deserialize)]
pub struct RecommendBody {
    intent: String,
}

/// `POST /api/recommend` — one experience plus two alternatives.
///
/// Concierge failures are 503, not 500: the client degrades to browsing.
async fn recommend(
    State(state): State<AppState>,
    Json(body): Json<RecommendBody>,
) -> ApiResult<Json<Recommendation>> {
    let intent = body.intent.trim();
    if intent.chars().count() < MIN_INTENT_CHARS {
        return Err(ApiError::Validation(
            "cuéntanos un poco más sobre tu viaje".into(),
        ));
    }
    let intent: String = intent.chars().take(MAX_INTENT_CHARS).collect();

    let packages = state
        .db
        .packages()
        .list(PackageFilter {
            destination: None,
            q: None,
        })
        .await?;

    match concierge::recommend(&state.config, &packages, &intent).await {
        Ok(rec) => {
            tracing::info!(
                package_id = ?rec.package.id,
                elapsed_ms = rec.elapsed_ms,
                "concierge recommendation"
            );
            Ok(Json(rec))
        }
        Err(err) => {
            if matches!(err, ConciergeError::UngroundedChoice(_)) {
                tracing::warn!(%err, "concierge returned an unknown package");
            } else {
                tracing::warn!(%err, "concierge unavailable");
            }
            Err(ApiError::ConciergeUnavailable)
        }
    }
}

/// Concierge routes, to be merged under `/api`.
pub fn routes() -> Router<AppState> {
    Router::new().route("/recommend", post(recommend))
}
