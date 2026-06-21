//! Domain models, DTOs, and small domain helpers.
//!
//! Wire JSON is camelCase (`#[serde(rename_all = "camelCase")]`) while Rust
//! keeps snake_case. Dates are ISO strings: `Departure::date` /
//! `Booking::departure_date` are date-only (`YYYY-MM-DD`); `Booking::created_at`
//! is an RFC 3339 datetime. Ids are opaque hex **strings** (Mongo `_id`),
//! assigned on insert (Task 04), hence `Option<String>` on read models.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

/// Destinations offered. Variant names are the exact wire strings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(ts_rs::TS))]
pub enum Destination {
    PuntaCana,
    Samana,
    Bayahibe,
    LaRomana,
}

/// Lifecycle of a booking. Variant names are the exact wire strings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(ts_rs::TS))]
pub enum BookingStatus {
    Pendiente,
    Confirmada,
}

/// A fixed departure date with its per-person price (RD$).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct Departure {
    pub date: NaiveDate,
    pub price: u32,
}

/// Customer contact details captured on a booking.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct Contact {
    pub name: String,
    pub phone: String,
    pub email: String,
}

/// A travel package (the "brochure"). Read model — `id` and `price_from` are
/// server-managed (`price_from` computed from `departures` on write).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct Package {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub title: String,
    pub destination: Destination,
    pub hero_image: String,
    pub gallery: Vec<String>,
    pub short_pitch: String,
    pub description_md: String,
    pub included: Vec<String>,
    pub not_included: Vec<String>,
    pub departures: Vec<Departure>,
    pub price_from: u32,
    pub featured: bool,
}

/// A customer booking against one departure of a package. Read model — `id`,
/// `code`, `total`, `status`, and `created_at` are all server-managed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct Booking {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub code: String,
    pub package_id: String,
    pub departure_date: NaiveDate,
    pub people: u32,
    pub total: u32,
    pub contact: Contact,
    pub status: BookingStatus,
    pub created_at: DateTime<Utc>,
}

/// Payload the agent sends to create a package. Omits server-managed fields
/// (`id`, `price_from`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct NewPackage {
    pub title: String,
    pub destination: Destination,
    pub hero_image: String,
    pub gallery: Vec<String>,
    pub short_pitch: String,
    pub description_md: String,
    pub included: Vec<String>,
    pub not_included: Vec<String>,
    pub departures: Vec<Departure>,
    pub featured: bool,
}

/// Payload to update a package. PUT replaces the editable fields, so the shape
/// matches [`NewPackage`].
pub type UpdatePackage = NewPackage;

/// Payload the customer sends to create a booking. The server assigns `code`,
/// computes `total`, sets `status = Pendiente` and `created_at`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct NewBooking {
    pub package_id: String,
    pub departure_date: NaiveDate,
    pub people: u32,
    pub contact: Contact,
}

/// Validation failures across the domain.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum DomainError {
    #[error("people must be between 1 and 12, got {0}")]
    InvalidPeople(u32),
    #[error("contact name is required")]
    EmptyName,
    #[error("contact phone is required")]
    EmptyPhone,
    #[error("invalid email address: {0:?}")]
    InvalidEmail(String),
    #[error("departure date {0} is not offered by this package")]
    DepartureNotFound(NaiveDate),
    #[error("package title is required")]
    EmptyTitle,
    #[error("a package must have at least one departure")]
    NoDepartures,
    #[error("every departure price must be greater than zero")]
    InvalidPrice,
}

/// Lowest price across a set of departures, or `0` if there are none.
#[must_use]
pub fn price_from(departures: &[Departure]) -> u32 {
    departures.iter().map(|d| d.price).min().unwrap_or(0)
}

/// Total cost of a booking: per-person `price` times `people`.
///
/// Uses saturating multiplication so an absurd `people` count can never wrap;
/// callers validate `people` (1..=12) before reaching this.
#[must_use]
pub fn compute_total(price: u32, people: u32) -> u32 {
    price.saturating_mul(people)
}

/// Generate a short human booking code like `CB-7F3K`.
///
/// Four uppercase chars/digits drawn from an alphabet that excludes the
/// visually ambiguous `O/0` and `I/1`.
#[must_use]
pub fn generate_booking_code() -> String {
    use rand::Rng;
    // No O, 0, I, or 1.
    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    let suffix: String = (0..4)
        .map(|_| ALPHABET[rng.gen_range(0..ALPHABET.len())] as char)
        .collect();
    format!("CB-{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_package() -> Package {
        Package {
            id: Some("64b8f0c2a1e4d3b2c1a09876".to_string()),
            title: "Escapada a Samaná".to_string(),
            destination: Destination::Samana,
            hero_image: "https://img/hero.jpg".to_string(),
            gallery: vec!["https://img/1.jpg".to_string()],
            short_pitch: "Tres días de playa".to_string(),
            description_md: "# Samaná\nUna escapada.".to_string(),
            included: vec!["Hotel".to_string()],
            not_included: vec!["Vuelos".to_string()],
            departures: vec![
                Departure {
                    date: NaiveDate::from_ymd_opt(2026, 6, 14).unwrap(),
                    price: 24900,
                },
                Departure {
                    date: NaiveDate::from_ymd_opt(2026, 7, 5).unwrap(),
                    price: 26900,
                },
            ],
            price_from: 24900,
            featured: true,
        }
    }

    #[test]
    fn package_round_trips_camel_case_json() {
        let pkg = sample_package();
        let json = serde_json::to_string(&pkg).unwrap();
        // camelCase keys on the wire.
        assert!(json.contains("\"heroImage\""));
        assert!(json.contains("\"shortPitch\""));
        assert!(json.contains("\"descriptionMd\""));
        assert!(json.contains("\"notIncluded\""));
        assert!(json.contains("\"priceFrom\""));
        // Destination + date wire shapes.
        assert!(json.contains("\"destination\":\"Samana\""));
        assert!(json.contains("\"date\":\"2026-06-14\""));
        let back: Package = serde_json::from_str(&json).unwrap();
        assert_eq!(pkg, back);
    }

    #[test]
    fn new_booking_parses_documented_request() {
        let body = r#"{ "packageId":"abc", "departureDate":"2026-06-14", "people":2,
            "contact":{"name":"María Pérez","phone":"809-555-0142","email":"m@x.do"} }"#;
        let nb: NewBooking = serde_json::from_str(body).unwrap();
        assert_eq!(nb.package_id, "abc");
        assert_eq!(nb.people, 2);
        assert_eq!(
            nb.departure_date,
            NaiveDate::from_ymd_opt(2026, 6, 14).unwrap()
        );
        assert_eq!(nb.contact.email, "m@x.do");
    }

    #[test]
    fn booking_status_and_id_skip_wire_shapes() {
        // Status serializes to the Spanish variant name.
        let json = serde_json::to_string(&BookingStatus::Pendiente).unwrap();
        assert_eq!(json, "\"Pendiente\"");
        // None id is omitted from JSON.
        let mut pkg = sample_package();
        pkg.id = None;
        let json = serde_json::to_string(&pkg).unwrap();
        assert!(!json.contains("\"id\""));
    }

    #[test]
    fn price_from_is_min_or_zero() {
        let pkg = sample_package();
        assert_eq!(price_from(&pkg.departures), 24900);
        assert_eq!(price_from(&[]), 0);
    }

    #[test]
    fn compute_total_multiplies() {
        assert_eq!(compute_total(24900, 2), 49800);
        assert_eq!(compute_total(0, 5), 0);
    }

    #[test]
    fn booking_code_format_stable_and_unambiguous() {
        let valid = regex::Regex::new(r"^CB-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$").unwrap();
        for _ in 0..10_000 {
            let code = generate_booking_code();
            assert!(valid.is_match(&code), "bad code: {code}");
            // Belt-and-suspenders: no ambiguous glyphs anywhere in the suffix.
            assert!(!code[3..].contains(['O', '0', 'I', '1']));
        }
    }
}
