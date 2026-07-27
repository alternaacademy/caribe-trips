//! Concierge resource: free-text intent in, one grounded recommendation out.

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use caribe_core::PackageFilter;
use serde::Deserialize;

use crate::concierge::{self, ConciergeError, Recommendation};
use crate::error::{ApiError, ApiResult};
use crate::events::{self, Estado, ANONIMO};
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

    let started = std::time::Instant::now();
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
            // `fits=false` is a successful call that found nothing — worth
            // separating in Kibana from a genuine match.
            let detalle = if rec.fits { "match" } else { "sin_match" };
            events::emit(
                "concierge_consulta",
                ANONIMO,
                rec.elapsed_ms,
                Estado::Ok,
                Some(detalle),
            );
            Ok(Json(rec))
        }
        Err(err) => {
            tracing::warn!(%err, "concierge failed");
            let motivo = match err {
                ConciergeError::Disabled => "desactivado",
                ConciergeError::Unreachable(_) => "inalcanzable",
                ConciergeError::TimedOut => "timeout",
                ConciergeError::BadResponse(_) => "respuesta_invalida",
                ConciergeError::UngroundedChoice(_) => "paquete_inexistente",
            };
            events::emit(
                "concierge_consulta",
                ANONIMO,
                started.elapsed().as_millis() as u64,
                Estado::Error,
                Some(motivo),
            );
            Err(match err {
                ConciergeError::TimedOut => ApiError::ConciergeTimeout,
                ConciergeError::BadResponse(_) | ConciergeError::UngroundedChoice(_) => {
                    ApiError::ConciergeConfused
                }
                ConciergeError::Disabled | ConciergeError::Unreachable(_) => {
                    ApiError::ConciergeUnavailable
                }
            })
        }
    }
}

/// Concierge routes, to be merged under `/api`.
pub fn routes() -> Router<AppState> {
    Router::new().route("/recommend", post(recommend))
}
