//! Booking resource: customer create + confirmation lookup, agent list + confirm.
//!
//! The server is authoritative: it generates the `code`, computes `total` from
//! the package's departure price, and sets `status`/`created_at` — client-sent
//! values for those are ignored.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::Json;
use axum::Router;
use caribe_core::{
    compute_total, generate_booking_code, validate_new_booking, Booking, BookingStatus, NewBooking,
    RepoError,
};
use serde::Deserialize;

use super::parse_enum;
use crate::error::{ApiError, ApiResult};
use crate::events::{self, Estado};
use crate::state::AppState;

/// How many times to regenerate a code on the (rare) unique-index collision.
const CODE_RETRIES: usize = 5;

/// Query params for the agent list endpoint.
#[derive(Debug, Deserialize)]
pub struct BookingQuery {
    /// Optional status filter (`Pendiente` | `Confirmada`).
    status: Option<String>,
}

/// `POST /api/bookings` — create a pending booking. Server computes total + code.
async fn create(
    State(state): State<AppState>,
    Json(body): Json<NewBooking>,
) -> ApiResult<(StatusCode, Json<Booking>)> {
    let started = std::time::Instant::now();
    // Unknown package → 404.
    let package = state.db.packages().get(&body.package_id).await?;

    // Domain validation: party size, contact, and that the departure is offered.
    validate_new_booking(&body, &package)?;

    // Authoritative total from the matching departure (validation guarantees it
    // exists; we still guard defensively).
    let price = package
        .departures
        .iter()
        .find(|d| d.date == body.departure_date)
        .map(|d| d.price)
        .ok_or_else(|| ApiError::Validation("fecha no disponible".to_string()))?;
    let total = compute_total(price, body.people);

    // Insert, regenerating the code on the rare collision.
    let bookings = state.db.bookings();
    for _ in 0..CODE_RETRIES {
        let booking = Booking {
            id: None,
            code: generate_booking_code(),
            package_id: body.package_id.clone(),
            departure_date: body.departure_date,
            people: body.people,
            total,
            contact: body.contact.clone(),
            status: BookingStatus::Pendiente,
            created_at: chrono::Utc::now(),
        };
        match bookings.create(booking).await {
            Ok(created) => {
                events::emit(
                    "reserva_creada",
                    &events::usuario_hash(&body.contact.email),
                    started.elapsed().as_millis() as u64,
                    Estado::Ok,
                    Some(&created.code),
                );
                return Ok((StatusCode::CREATED, Json(created)));
            }
            Err(RepoError::DuplicateCode) => continue,
            Err(e) => return Err(e.into()),
        }
    }
    Err(ApiError::Internal(
        "could not generate a unique booking code".to_string(),
    ))
}

/// `GET /api/bookings` — agent list, pending-first then newest; optional status.
async fn list(
    State(state): State<AppState>,
    Query(query): Query<BookingQuery>,
) -> ApiResult<Json<Vec<Booking>>> {
    let status = match query.status.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(parse_enum::<BookingStatus>("status", s)?),
        None => None,
    };
    let mut items = state.db.bookings().list(status).await?;
    // Repo returns newest-first; a stable sort by status keeps that order within
    // each group while floating pending bookings to the top.
    items.sort_by_key(|b| match b.status {
        BookingStatus::Pendiente => 0,
        BookingStatus::Confirmada => 1,
    });
    Ok(Json(items))
}

/// `GET /api/bookings/{code}` — confirmation lookup by human code; 404 if none.
async fn by_code(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> ApiResult<Json<Booking>> {
    Ok(Json(state.db.bookings().get_by_code(&code).await?))
}

/// `POST /api/bookings/{id}/confirm` — flip Pendiente→Confirmada; 409 if already
/// confirmed, 404 if missing.
async fn confirm(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Booking>> {
    let started = std::time::Instant::now();
    let booking = state.db.bookings().confirm(&id).await?;
    events::emit(
        "reserva_confirmada",
        &events::usuario_hash(&booking.contact.email),
        started.elapsed().as_millis() as u64,
        Estado::Ok,
        Some(&booking.code),
    );
    Ok(Json(booking))
}

/// Booking routes, to be merged under `/api`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/bookings", get(list).post(create))
        .route("/bookings/{code}", get(by_code))
        .route("/bookings/{id}/confirm", post(confirm))
}
