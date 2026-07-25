//! Concierge failure modes, driven against a stub Ollama on a real socket.
//!
//! These are the paths that matter most in production and are the hardest to
//! reproduce by hand: the model box being gone, the model being too slow, and
//! the model answering with something unusable. No MongoDB and no real model.

use std::time::Duration;

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use caribe_api::concierge::{recommend, ConciergeError};
use caribe_api::config::Config;
use caribe_core::{Departure, Destination, Package};
use serde_json::{json, Value};

fn config(ollama_url: String, timeout_ms: u64) -> Config {
    Config {
        mongodb_uri: String::new(),
        mongodb_db: String::new(),
        api_bind: "127.0.0.1:0".into(),
        web_origin: "http://localhost:5173".into(),
        extra_origin: None,
        ollama_url,
        ollama_model: "stub".into(),
        ollama_timeout_ms: timeout_ms,
        concierge_enabled: true,
    }
}

fn catalog() -> Vec<Package> {
    (1..=3)
        .map(|i| Package {
            id: Some(format!("id{i}")),
            title: format!("Paquete {i}"),
            destination: Destination::Samana,
            hero_image: String::new(),
            gallery: vec![],
            short_pitch: "Pitch".into(),
            description_md: String::new(),
            included: vec![],
            not_included: vec![],
            departures: vec![Departure {
                date: "2026-08-09".parse().unwrap(),
                price: 1000,
            }],
            price_from: 1000,
            featured: false,
        })
        .collect()
}

/// Serve one canned `/api/chat` reply, optionally after a delay.
async fn stub_ollama(content: Value, delay: Duration) -> String {
    let app = Router::new()
        .route(
            "/api/chat",
            post(|State((body, delay)): State<(Value, Duration)>| async move {
                tokio::time::sleep(delay).await;
                Json(body)
            }),
        )
        .with_state((content, delay));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    format!("http://{addr}")
}

/// Ollama replies with a well-formed choice.
fn reply(content: Value) -> Value {
    json!({ "message": { "content": content.to_string() } })
}

fn good_choice() -> Value {
    json!({
        "pick": 2,
        "headline": "Una escapada",
        "why": "Encaja con lo que busca.",
        "considerations": "Dura un día.",
        "alsoConsider": [1, 3],
        "fits": true,
        "confidence": 0.9
    })
}

#[tokio::test]
async fn happy_path_resolves_positions_to_packages() {
    let url = stub_ollama(reply(good_choice()), Duration::ZERO).await;
    let rec = recommend(&config(url, 5_000), &catalog(), "algo tranquilo")
        .await
        .expect("recommendation");

    assert_eq!(rec.package.title, "Paquete 2");
    let alts: Vec<&str> = rec.also_consider.iter().map(|p| p.title.as_str()).collect();
    assert_eq!(alts, ["Paquete 1", "Paquete 3"]);
    assert_eq!(rec.confidence, 0.9);
    assert!(rec.fits);
}

/// The model says nothing in the catalog answers the request. The closest pick
/// still comes back — the UI reframes it instead of showing a dead end.
#[tokio::test]
async fn no_match_still_returns_the_closest_option() {
    let mut choice = good_choice();
    choice["fits"] = json!(false);
    choice["considerations"] = json!("No ofrecemos viajes a Japón.");
    let url = stub_ollama(reply(choice), Duration::ZERO).await;

    let rec = recommend(&config(url, 5_000), &catalog(), "quiero ir a Tokio")
        .await
        .expect("recommendation");
    assert!(!rec.fits);
    assert_eq!(rec.package.title, "Paquete 2");
    assert_eq!(rec.considerations, "No ofrecemos viajes a Japón.");
}

/// An older model that omits `fits` must not be read as "nothing matches".
#[tokio::test]
async fn missing_fits_defaults_to_true() {
    let mut choice = good_choice();
    choice.as_object_mut().unwrap().remove("fits");
    let url = stub_ollama(reply(choice), Duration::ZERO).await;

    let rec = recommend(&config(url, 5_000), &catalog(), "hola")
        .await
        .expect("recommendation");
    assert!(rec.fits);
}

/// gauss is off / unplugged / not on the tailnet.
#[tokio::test]
async fn unreachable_model_is_reported_as_unreachable() {
    // Port 1 on loopback refuses immediately.
    let err = recommend(&config("http://127.0.0.1:1".into(), 2_000), &catalog(), "hola")
        .await
        .expect_err("must fail");
    assert!(
        matches!(err, ConciergeError::Unreachable(_)),
        "got {err:?}"
    );
}

/// The model is up but slower than the budget — distinct from unreachable so
/// the UI can say "tardó demasiado" instead of "no disponible".
#[tokio::test]
async fn slow_model_times_out_rather_than_hanging() {
    let url = stub_ollama(reply(good_choice()), Duration::from_millis(1_500)).await;
    let err = recommend(&config(url, 300), &catalog(), "hola")
        .await
        .expect_err("must fail");
    assert!(matches!(err, ConciergeError::TimedOut), "got {err:?}");
}

/// A thinking model with `think` left on returns an empty `content`.
#[tokio::test]
async fn empty_content_is_a_bad_response() {
    let url = stub_ollama(json!({ "message": { "content": "" } }), Duration::ZERO).await;
    let err = recommend(&config(url, 5_000), &catalog(), "hola")
        .await
        .expect_err("must fail");
    assert!(matches!(err, ConciergeError::BadResponse(_)), "got {err:?}");
}

#[tokio::test]
async fn unparseable_content_is_a_bad_response() {
    let url = stub_ollama(
        json!({ "message": { "content": "lo siento, no entiendo" } }),
        Duration::ZERO,
    )
    .await;
    let err = recommend(&config(url, 5_000), &catalog(), "hola")
        .await
        .expect_err("must fail");
    assert!(matches!(err, ConciergeError::BadResponse(_)), "got {err:?}");
}

/// The model invents a package that isn't in the catalog. This is the one that
/// would put a fabricated offer on screen, so it must never resolve.
#[tokio::test]
async fn out_of_range_pick_is_never_rendered() {
    let mut choice = good_choice();
    choice["pick"] = json!(99);
    let url = stub_ollama(reply(choice), Duration::ZERO).await;

    let err = recommend(&config(url, 5_000), &catalog(), "hola")
        .await
        .expect_err("must fail");
    assert!(
        matches!(err, ConciergeError::UngroundedChoice(99)),
        "got {err:?}"
    );
}

/// A bogus alternative is dropped instead of failing the whole answer.
#[tokio::test]
async fn out_of_range_alternatives_are_dropped() {
    let mut choice = good_choice();
    choice["alsoConsider"] = json!([1, 99, 0, -4]);
    let url = stub_ollama(reply(choice), Duration::ZERO).await;

    let rec = recommend(&config(url, 5_000), &catalog(), "hola")
        .await
        .expect("recommendation");
    let alts: Vec<&str> = rec.also_consider.iter().map(|p| p.title.as_str()).collect();
    assert_eq!(alts, ["Paquete 1"]);
}

/// The kill switch short-circuits before any network call.
#[tokio::test]
async fn disabled_concierge_never_calls_the_model() {
    let mut cfg = config("http://127.0.0.1:1".into(), 5_000);
    cfg.concierge_enabled = false;
    let err = recommend(&cfg, &catalog(), "hola").await.expect_err("must fail");
    assert!(matches!(err, ConciergeError::Disabled), "got {err:?}");
}
