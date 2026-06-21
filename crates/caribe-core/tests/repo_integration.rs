//! Integration tests for the MongoDB repository layer.
//!
//! Gated on `MONGODB_TEST_URI`: when it is unset the tests no-op so the default
//! `cargo test` stays hermetic. Run them against the compose Mongo with:
//!
//! ```sh
//! just up
//! MONGODB_TEST_URI=mongodb://localhost:27017 cargo test -p caribe-core --test repo_integration
//! ```
//!
//! Each test uses its own database name so they stay isolated under parallelism.

use caribe_core::models::{Booking, BookingStatus, Contact, Departure, Destination, NewPackage};
use caribe_core::repo::{Db, PackageFilter, RepoError};
use caribe_core::seed::{seed, SeedMode};
use chrono::{NaiveDate, Utc};

/// Connect to a per-test database and start from a clean slate.
async fn fresh_db(name: &str) -> Option<Db> {
    let uri = std::env::var("MONGODB_TEST_URI").ok()?;
    let db = Db::connect(&uri, name).await.expect("connect");
    // Clean slate: dropping the (possibly absent) database is idempotent.
    db.drop_database().await.expect("drop");
    db.ensure_indexes().await.expect("indexes");
    // ensure_indexes is idempotent — calling twice must not error.
    db.ensure_indexes().await.expect("indexes idempotent");
    Some(db)
}

fn d(y: i32, m: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(y, m, day).unwrap()
}

fn new_package(title: &str, dest: Destination, prices: &[(NaiveDate, u32)]) -> NewPackage {
    NewPackage {
        title: title.to_string(),
        destination: dest,
        hero_image: "https://img/hero.jpg".to_string(),
        gallery: vec![],
        short_pitch: format!("{title} pitch"),
        description_md: "# desc".to_string(),
        included: vec!["Hotel".to_string()],
        not_included: vec![],
        departures: prices
            .iter()
            .map(|(date, price)| Departure {
                date: *date,
                price: *price,
            })
            .collect(),
        featured: false,
    }
}

#[tokio::test]
async fn package_crud_and_filtering() {
    let Some(db) = fresh_db("caribe_trips_test_packages").await else {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    };
    let repo = db.packages();

    // create derives price_from = min departure price.
    let samana = repo
        .create(new_package(
            "Escapada a Samaná",
            Destination::Samana,
            &[(d(2026, 6, 14), 26900), (d(2026, 7, 5), 24900)],
        ))
        .await
        .unwrap();
    assert_eq!(samana.price_from, 24900);
    let id = samana.id.clone().unwrap();

    repo.create(new_package(
        "Aventura en Punta Cana",
        Destination::PuntaCana,
        &[(d(2026, 6, 20), 31000)],
    ))
    .await
    .unwrap();

    // get by id round-trips.
    assert_eq!(repo.get(&id).await.unwrap().title, "Escapada a Samaná");

    // list all.
    assert_eq!(repo.list(PackageFilter::default()).await.unwrap().len(), 2);

    // filter by destination.
    let only_samana = repo
        .list(PackageFilter {
            destination: Some(Destination::Samana),
            q: None,
        })
        .await
        .unwrap();
    assert_eq!(only_samana.len(), 1);
    assert_eq!(only_samana[0].destination, Destination::Samana);

    // filter by q, case-insensitive, matching title.
    let by_q = repo
        .list(PackageFilter {
            destination: None,
            q: Some("SAMANÁ".to_string()),
        })
        .await
        .unwrap();
    assert_eq!(by_q.len(), 1);

    // update replaces fields and re-derives price_from.
    let mut updated_payload = new_package(
        "Escapada a Samaná (oferta)",
        Destination::Samana,
        &[(d(2026, 6, 14), 19900)],
    );
    updated_payload.featured = true;
    let updated = repo.update(&id, updated_payload).await.unwrap();
    assert_eq!(updated.price_from, 19900);
    assert!(updated.featured);
    assert_eq!(updated.id.as_deref(), Some(id.as_str()));

    // delete, then it is gone.
    repo.delete(&id).await.unwrap();
    assert!(matches!(repo.get(&id).await, Err(RepoError::NotFound)));

    // unknown + malformed ids → NotFound, never a panic.
    assert!(matches!(
        repo.get("not-an-objectid").await,
        Err(RepoError::NotFound)
    ));
    assert!(matches!(
        repo.delete("64b8f0c2a1e4d3b2c1a09876").await,
        Err(RepoError::NotFound)
    ));
}

#[tokio::test]
async fn booking_create_confirm_and_unique_code() {
    let Some(db) = fresh_db("caribe_trips_test_bookings").await else {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    };
    let repo = db.bookings();

    let booking = Booking {
        id: None,
        code: "CB-7F3K".to_string(),
        package_id: "pkg123".to_string(),
        departure_date: d(2026, 6, 14),
        people: 2,
        total: 49800,
        contact: Contact {
            name: "María Pérez".to_string(),
            phone: "809-555-0142".to_string(),
            email: "m@x.do".to_string(),
        },
        status: BookingStatus::Pendiente,
        created_at: Utc::now(),
    };

    let created = repo.create(booking.clone()).await.unwrap();
    let id = created.id.clone().unwrap();
    assert_eq!(created.status, BookingStatus::Pendiente);

    // lookup by code.
    let found = repo.get_by_code("CB-7F3K").await.unwrap();
    assert_eq!(found.id, created.id);

    // list pending finds it; list confirmed does not (yet).
    assert_eq!(
        repo.list(Some(BookingStatus::Pendiente))
            .await
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        repo.list(Some(BookingStatus::Confirmada))
            .await
            .unwrap()
            .len(),
        0
    );

    // confirm flips status.
    let confirmed = repo.confirm(&id).await.unwrap();
    assert_eq!(confirmed.status, BookingStatus::Confirmada);

    // confirm is not repeatable.
    assert!(matches!(
        repo.confirm(&id).await,
        Err(RepoError::AlreadyConfirmed)
    ));

    // unknown id → NotFound.
    assert!(matches!(
        repo.confirm("64b8f0c2a1e4d3b2c1a09876").await,
        Err(RepoError::NotFound)
    ));
    assert!(matches!(
        repo.get_by_code("CB-XXXX").await,
        Err(RepoError::NotFound)
    ));

    // duplicate code rejected by the unique index.
    assert!(matches!(
        repo.create(booking).await,
        Err(RepoError::DuplicateCode)
    ));
}

#[tokio::test]
async fn seed_is_idempotent_and_resettable() {
    let Some(db) = fresh_db("caribe_trips_test_seed").await else {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    };

    // Fresh DB → IfEmpty inserts the full fixture set.
    let first = seed(&db, SeedMode::IfEmpty).await.unwrap();
    assert!(first.inserted);
    assert_eq!(first.packages, 6);
    assert_eq!(first.bookings, 6);

    // Second IfEmpty is a no-op — no duplication.
    let second = seed(&db, SeedMode::IfEmpty).await.unwrap();
    assert!(!second.inserted);
    assert_eq!(
        db.packages()
            .list(PackageFilter::default())
            .await
            .unwrap()
            .len(),
        6
    );
    assert_eq!(db.bookings().list(None).await.unwrap().len(), 6);

    // Featured flags match the design data exactly.
    let featured: Vec<String> = {
        let mut titles: Vec<String> = db
            .packages()
            .list(PackageFilter::default())
            .await
            .unwrap()
            .into_iter()
            .filter(|p| p.featured)
            .map(|p| p.title)
            .collect();
        titles.sort();
        titles
    };
    assert_eq!(
        featured,
        vec![
            "Catalina & Altos de Chavón".to_string(),
            "Escapada a Samaná".to_string(),
            "Punta Cana Todo Incluido".to_string(),
        ]
    );

    // Booking split: 4 Pendiente, 2 Confirmada; totals are price * people.
    assert_eq!(
        db.bookings()
            .list(Some(BookingStatus::Pendiente))
            .await
            .unwrap()
            .len(),
        4
    );
    assert_eq!(
        db.bookings()
            .list(Some(BookingStatus::Confirmada))
            .await
            .unwrap()
            .len(),
        2
    );
    let cb7f3k = db.bookings().get_by_code("CB-7F3K").await.unwrap();
    assert_eq!(cb7f3k.total, 49800); // 24900 * 2

    // Reset rebuilds exactly the fixture set (no growth across runs).
    let reset = seed(&db, SeedMode::Reset).await.unwrap();
    assert!(reset.inserted);
    assert_eq!(
        db.packages()
            .list(PackageFilter::default())
            .await
            .unwrap()
            .len(),
        6
    );
    assert_eq!(db.bookings().list(None).await.unwrap().len(), 6);
}
