//! Package resource: public list/detail, agent create/update/delete.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::Json;
use axum::Router;
use caribe_core::{
    validate_new_package, Destination, NewPackage, Package, PackageFilter, UpdatePackage,
};
use serde::Deserialize;

use super::parse_enum;
use crate::error::ApiResult;
use crate::state::AppState;

/// Query params for the list endpoint.
#[derive(Debug, Deserialize)]
pub struct PackageQuery {
    /// Destination enum string (e.g. `Samana`).
    destination: Option<String>,
    /// Free-text search over title / short pitch.
    q: Option<String>,
}

/// `GET /api/packages` — list with optional destination + text filters.
async fn list(
    State(state): State<AppState>,
    Query(query): Query<PackageQuery>,
) -> ApiResult<Json<Vec<Package>>> {
    let destination = match query.destination.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(parse_enum::<Destination>("destination", s)?),
        None => None,
    };
    let filter = PackageFilter {
        destination,
        q: query.q.filter(|s| !s.is_empty()),
    };
    Ok(Json(state.db.packages().list(filter).await?))
}

/// `GET /api/packages/{id}` — one package or 404.
async fn detail(State(state): State<AppState>, Path(id): Path<String>) -> ApiResult<Json<Package>> {
    Ok(Json(state.db.packages().get(&id).await?))
}

/// `POST /api/packages` — validate + create; 201.
async fn create(
    State(state): State<AppState>,
    Json(body): Json<NewPackage>,
) -> ApiResult<(StatusCode, Json<Package>)> {
    validate_new_package(&body)?;
    let created = state.db.packages().create(body).await?;
    Ok((StatusCode::CREATED, Json(created)))
}

/// `PUT /api/packages/{id}` — validate + replace; 200 or 404.
async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePackage>,
) -> ApiResult<Json<Package>> {
    validate_new_package(&body)?;
    Ok(Json(state.db.packages().update(&id, body).await?))
}

/// `DELETE /api/packages/{id}` — 204 or 404.
async fn delete(State(state): State<AppState>, Path(id): Path<String>) -> ApiResult<StatusCode> {
    state.db.packages().delete(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Package routes, to be merged under `/api`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/packages", get(list).post(create))
        .route("/packages/{id}", get(detail).put(update).delete(delete))
}
