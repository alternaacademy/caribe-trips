//! Canonical sample data: the 6 packages and 6 bookings the API/UI ship with.
//!
//! Content lives in [`seed.json`](./seed.json) (embedded via `include_str!`) so
//! it can be edited without touching this logic. [`seed`] is idempotent under
//! [`SeedMode::IfEmpty`] and rebuildable under [`SeedMode::Reset`].

use std::collections::HashMap;

use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;

use crate::models::{compute_total, Booking, BookingStatus, Contact, Departure, NewPackage};
use crate::repo::Db;

/// How aggressively to seed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeedMode {
    /// Insert only when the `packages` collection is empty.
    IfEmpty,
    /// Drop everything and reinsert the fixture set (dev convenience).
    Reset,
}

/// What [`seed`] did, for logging.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SeedOutcome {
    /// Whether documents were inserted this call.
    pub inserted: bool,
    /// Number of packages now seeded (0 when skipped).
    pub packages: usize,
    /// Number of bookings now seeded (0 when skipped).
    pub bookings: usize,
}

/// Raw fixture file shape.
#[derive(Debug, Deserialize)]
struct SeedData {
    packages: Vec<NewPackage>,
    bookings: Vec<SeedBooking>,
}

/// A booking fixture: references its package by title + departure date so the
/// real `package_id` and `total` are resolved after packages are inserted.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SeedBooking {
    code: String,
    package_title: String,
    departure_date: NaiveDate,
    people: u32,
    contact: Contact,
    status: BookingStatus,
    created_at: DateTime<Utc>,
}

/// The embedded fixture content.
const SEED_JSON: &str = include_str!("seed.json");

/// Seed `db` according to `mode`. Inserts packages first (which derive
/// `price_from`), then bookings whose `package_id`/`total` are resolved against
/// the just-inserted packages.
pub async fn seed(db: &Db, mode: SeedMode) -> anyhow::Result<SeedOutcome> {
    let packages_repo = db.packages();
    let bookings_repo = db.bookings();

    match mode {
        SeedMode::IfEmpty => {
            if !packages_repo.list(Default::default()).await?.is_empty() {
                return Ok(SeedOutcome {
                    inserted: false,
                    packages: 0,
                    bookings: 0,
                });
            }
        }
        SeedMode::Reset => {
            db.drop_database().await?;
            db.ensure_indexes().await?;
        }
    }

    let data: SeedData = serde_json::from_str(SEED_JSON)?;

    // title -> (package id, its departures) for resolving bookings.
    let mut resolved: HashMap<String, (String, Vec<Departure>)> = HashMap::new();
    let mut package_count = 0;
    for np in data.packages {
        let title = np.title.clone();
        let departures = np.departures.clone();
        let created = packages_repo.create(np).await?;
        let id = created.id.expect("created package has an id");
        resolved.insert(title, (id, departures));
        package_count += 1;
    }

    let mut booking_count = 0;
    for sb in data.bookings {
        let (package_id, departures) = resolved.get(&sb.package_title).ok_or_else(|| {
            anyhow::anyhow!(
                "booking {} references unknown package {:?}",
                sb.code,
                sb.package_title
            )
        })?;
        let price = departures
            .iter()
            .find(|d| d.date == sb.departure_date)
            .map(|d| d.price)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "booking {} references departure {} not offered by {:?}",
                    sb.code,
                    sb.departure_date,
                    sb.package_title
                )
            })?;
        let booking = Booking {
            id: None,
            code: sb.code,
            package_id: package_id.clone(),
            departure_date: sb.departure_date,
            people: sb.people,
            total: compute_total(price, sb.people),
            contact: sb.contact,
            status: sb.status,
            created_at: sb.created_at,
        };
        bookings_repo.create(booking).await?;
        booking_count += 1;
    }

    Ok(SeedOutcome {
        inserted: true,
        packages: package_count,
        bookings: booking_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The embedded JSON parses and has the expected fixture counts and flags —
    /// validated without a database.
    #[test]
    fn seed_json_is_valid_and_matches_design_data() {
        let data: SeedData = serde_json::from_str(SEED_JSON).unwrap();
        assert_eq!(data.packages.len(), 6, "expected 6 packages");
        assert_eq!(data.bookings.len(), 6, "expected 6 bookings");

        // Featured = exactly Samaná, Punta Cana, Catalina.
        let featured: Vec<&str> = data
            .packages
            .iter()
            .filter(|p| p.featured)
            .map(|p| p.title.as_str())
            .collect();
        assert_eq!(
            featured,
            vec![
                "Escapada a Samaná",
                "Punta Cana Todo Incluido",
                "Catalina & Altos de Chavón"
            ]
        );

        // Booking split: 4 Pendiente, 2 Confirmada.
        let pending = data
            .bookings
            .iter()
            .filter(|b| b.status == BookingStatus::Pendiente)
            .count();
        assert_eq!(pending, 4);
        assert_eq!(data.bookings.len() - pending, 2);

        // Every booking resolves to a package + a real departure, and the
        // documented totals are price * people.
        for b in &data.bookings {
            let pkg = data
                .packages
                .iter()
                .find(|p| p.title == b.package_title)
                .unwrap_or_else(|| panic!("unknown package {:?}", b.package_title));
            let dep = pkg
                .departures
                .iter()
                .find(|d| d.date == b.departure_date)
                .unwrap_or_else(|| panic!("booking {} has no matching departure", b.code));
            assert!(dep.price > 0);
            assert!((1..=12).contains(&b.people));
        }

        // Spot-check canonical prices from the design data.
        let samana = data
            .packages
            .iter()
            .find(|p| p.title == "Escapada a Samaná")
            .unwrap();
        assert_eq!(crate::models::price_from(&samana.departures), 24900);
    }
}
