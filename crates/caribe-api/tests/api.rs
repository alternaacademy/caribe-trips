//! HTTP integration tests for the full API surface.
//!
//! Gated on `MONGODB_TEST_URI` (hermetic by default). Each test uses its own
//! database name and drives the real router via `tower`'s `oneshot` — no socket.
//!
//! ```sh
//! just up
//! MONGODB_TEST_URI=mongodb://localhost:27017 cargo test -p caribe-api --test api
//! ```

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use caribe_api::app;
use caribe_api::config::Config;
use caribe_api::state::AppState;
use caribe_core::seed::{seed, SeedMode};
use caribe_core::Db;
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

fn test_config() -> Config {
    Config {
        mongodb_uri: String::new(),
        mongodb_db: String::new(),
        api_bind: "127.0.0.1:0".into(),
        web_origin: "http://localhost:5173".into(),
        extra_origin: None,
    }
}

/// Connect a fresh per-test database and build the app router over it.
/// Returns `None` (test no-ops) when `MONGODB_TEST_URI` is unset.
async fn app_with_fresh_db(name: &str) -> Option<Router> {
    let uri = std::env::var("MONGODB_TEST_URI").ok()?;
    let db = Db::connect(&uri, name).await.expect("connect");
    db.drop_database().await.expect("drop");
    db.ensure_indexes().await.expect("indexes");
    Some(app::router(AppState { db }, &test_config()))
}

/// Send a request through the router and decode `(status, json)`.
async fn send(app: &Router, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let builder = Request::builder().method(method).uri(uri);
    let request = match body {
        Some(v) => builder
            .header("content-type", "application/json")
            .body(Body::from(v.to_string()))
            .unwrap(),
        None => builder.body(Body::empty()).unwrap(),
    };
    let resp = app.clone().oneshot(request).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap()
    };
    (status, value)
}

#[tokio::test]
async fn packages_endpoints() {
    let Some(app) = app_with_fresh_db("caribe_trips_test_api_packages").await else {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    };
    // Seed via the router's DB so list has the 6 fixtures.
    let db = Db::connect(
        &std::env::var("MONGODB_TEST_URI").unwrap(),
        "caribe_trips_test_api_packages",
    )
    .await
    .unwrap();
    seed(&db, SeedMode::Reset).await.unwrap();

    // list → 6.
    let (status, body) = send(&app, "GET", "/api/packages", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_array().unwrap().len(), 6);

    // filter by destination.
    let (_, body) = send(&app, "GET", "/api/packages?destination=Samana", None).await;
    let titles: Vec<&str> = body
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["title"].as_str().unwrap())
        .collect();
    assert!(titles.contains(&"Escapada a Samaná"));
    assert!(titles.iter().all(|t| *t != "Buceo en Bayahíbe"));

    // text search.
    let (_, body) = send(&app, "GET", "/api/packages?q=buceo", None).await;
    assert_eq!(body.as_array().unwrap().len(), 1);
    assert_eq!(body[0]["title"], "Buceo en Bayahíbe");

    // invalid destination → 400 envelope.
    let (status, body) = send(&app, "GET", "/api/packages?destination=Narnia", None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], "validation_error");

    // detail + unknown id 404.
    let id = body_first_id(send(&app, "GET", "/api/packages", None).await.1);
    let (status, body) = send(&app, "GET", &format!("/api/packages/{id}"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"], id);
    let (status, body) = send(&app, "GET", "/api/packages/deadbeef", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_found");

    // create: invalid (empty title) → 400; valid → 201 with priceFrom.
    let invalid = json!({"title":"","destination":"Samana","heroImage":"","gallery":[],"shortPitch":"","descriptionMd":"","included":[],"notIncluded":[],"departures":[],"featured":false});
    let (status, _) = send(&app, "POST", "/api/packages", Some(invalid)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let valid = json!({"title":"Test","destination":"PuntaCana","heroImage":"h","gallery":[],"shortPitch":"s","descriptionMd":"d","included":[],"notIncluded":[],"departures":[{"date":"2026-09-01","price":5000},{"date":"2026-09-10","price":4000}],"featured":false});
    let (status, created) = send(&app, "POST", "/api/packages", Some(valid)).await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(created["priceFrom"], 4000);
    let new_id = created["id"].as_str().unwrap().to_string();

    // update → 200; unknown → 404.
    let upd = json!({"title":"Test 2","destination":"PuntaCana","heroImage":"h","gallery":[],"shortPitch":"s","descriptionMd":"d","included":[],"notIncluded":[],"departures":[{"date":"2026-09-01","price":7000}],"featured":true});
    let (status, updated) = send(
        &app,
        "PUT",
        &format!("/api/packages/{new_id}"),
        Some(upd.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["priceFrom"], 7000);
    let (status, _) = send(&app, "PUT", "/api/packages/deadbeef", Some(upd)).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // delete → 204; then 404.
    let (status, _) = send(&app, "DELETE", &format!("/api/packages/{new_id}"), None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _) = send(&app, "GET", &format!("/api/packages/{new_id}"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = send(&app, "DELETE", &format!("/api/packages/{new_id}"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn bookings_endpoints() {
    let Some(app) = app_with_fresh_db("caribe_trips_test_api_bookings").await else {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    };
    let db = Db::connect(
        &std::env::var("MONGODB_TEST_URI").unwrap(),
        "caribe_trips_test_api_bookings",
    )
    .await
    .unwrap();
    seed(&db, SeedMode::Reset).await.unwrap();

    // Find the Samaná package + its 2026-06-14 departure (price 24900).
    let (_, packages) = send(&app, "GET", "/api/packages?destination=Samana", None).await;
    let samana = packages
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["title"] == "Escapada a Samaná")
        .unwrap();
    let pkg_id = samana["id"].as_str().unwrap();

    // create: server computes total (ignores client total), code unique, Pendiente.
    let req = json!({"packageId":pkg_id,"departureDate":"2026-06-14","people":2,"total":1,
        "contact":{"name":"Ana","phone":"809-555-0000","email":"a@x.do"}});
    let (status, created) = send(&app, "POST", "/api/bookings", Some(req)).await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(created["total"], 49800);
    assert_eq!(created["status"], "Pendiente");
    let code = created["code"].as_str().unwrap();
    assert!(
        code.starts_with("CB-") && code.len() == 7,
        "bad code {code}"
    );

    // bad date → 400; unknown package → 404.
    let bad_date = json!({"packageId":pkg_id,"departureDate":"2026-12-31","people":2,
        "contact":{"name":"Ana","phone":"809-555-0000","email":"a@x.do"}});
    let (status, _) = send(&app, "POST", "/api/bookings", Some(bad_date)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let unknown_pkg = json!({"packageId":"deadbeef","departureDate":"2026-06-14","people":2,
        "contact":{"name":"Ana","phone":"809-555-0000","email":"a@x.do"}});
    let (status, _) = send(&app, "POST", "/api/bookings", Some(unknown_pkg)).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // list pending-first (seed has 4 pending + 2 confirmed, plus our new one = 5 pending).
    let (_, list) = send(&app, "GET", "/api/bookings", None).await;
    let statuses: Vec<&str> = list
        .as_array()
        .unwrap()
        .iter()
        .map(|b| b["status"].as_str().unwrap())
        .collect();
    let first_confirmed = statuses.iter().position(|s| *s == "Confirmada").unwrap();
    assert!(
        statuses[..first_confirmed]
            .iter()
            .all(|s| *s == "Pendiente"),
        "pending must precede confirmed"
    );

    // ?status filter.
    let (_, confirmed) = send(&app, "GET", "/api/bookings?status=Confirmada", None).await;
    assert!(confirmed
        .as_array()
        .unwrap()
        .iter()
        .all(|b| b["status"] == "Confirmada"));

    // get by code; confirm; double-confirm → 409.
    let (status, by_code) = send(&app, "GET", &format!("/api/bookings/{code}"), None).await;
    assert_eq!(status, StatusCode::OK);
    let booking_id = by_code["id"].as_str().unwrap().to_string();
    let (status, confirmed) = send(
        &app,
        "POST",
        &format!("/api/bookings/{booking_id}/confirm"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(confirmed["status"], "Confirmada");
    let (status, body) = send(
        &app,
        "POST",
        &format!("/api/bookings/{booking_id}/confirm"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"]["code"], "conflict");

    // unknown code → 404.
    let (status, _) = send(&app, "GET", "/api/bookings/CB-ZZZZ", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

fn body_first_id(body: Value) -> String {
    body[0]["id"].as_str().unwrap().to_string()
}
