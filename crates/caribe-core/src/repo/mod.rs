//! MongoDB repository layer.
//!
//! Wraps the `mongodb` driver so the rest of the backend works in domain
//! models, never BSON. [`Db::connect`] bootstraps a connection and
//! [`Db::ensure_indexes`] sets up the indexes the API relies on. Per-collection
//! CRUD lives in [`packages`] and [`bookings`].

mod bookings;
mod packages;

pub use bookings::BookingRepo;
pub use packages::{PackageFilter, PackageRepo};

use mongodb::bson::doc;
use mongodb::options::{ClientOptions, IndexOptions};
use mongodb::{Client, Database, IndexModel};

/// Errors surfaced by the repository layer.
#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    /// No document matched (also covers malformed/unknown ids).
    #[error("not found")]
    NotFound,
    /// A booking with the same `code` already exists (unique index violation).
    #[error("duplicate booking code")]
    DuplicateCode,
    /// `confirm` was called on a booking that is no longer `Pendiente`.
    #[error("booking already confirmed")]
    AlreadyConfirmed,
    /// Underlying driver error.
    #[error(transparent)]
    Mongo(#[from] mongodb::error::Error),
    /// BSON (de)serialization error.
    #[error(transparent)]
    Bson(#[from] mongodb::bson::ser::Error),
}

/// A connected MongoDB database plus typed-collection accessors.
#[derive(Clone)]
pub struct Db {
    database: Database,
}

impl Db {
    /// Connect to `uri`, select `db_name`, and ping to confirm reachability.
    pub async fn connect(uri: &str, db_name: &str) -> anyhow::Result<Self> {
        let options = ClientOptions::parse(uri).await?;
        let client = Client::with_options(options)?;
        let database = client.database(db_name);
        database.run_command(doc! { "ping": 1 }).await?;
        Ok(Self { database })
    }

    /// Create the indexes the API depends on. Idempotent — safe to call on every
    /// startup.
    pub async fn ensure_indexes(&self) -> Result<(), RepoError> {
        let packages = self
            .database
            .collection::<mongodb::bson::Document>("packages");
        packages
            .create_index(
                IndexModel::builder()
                    .keys(doc! { "destination": 1 })
                    .build(),
            )
            .await?;
        packages
            .create_index(IndexModel::builder().keys(doc! { "featured": 1 }).build())
            .await?;

        let bookings = self
            .database
            .collection::<mongodb::bson::Document>("bookings");
        bookings
            .create_index(IndexModel::builder().keys(doc! { "status": 1 }).build())
            .await?;
        bookings
            .create_index(
                IndexModel::builder()
                    .keys(doc! { "code": 1 })
                    .options(IndexOptions::builder().unique(true).build())
                    .build(),
            )
            .await?;
        Ok(())
    }

    /// Round-trip a `ping` to confirm the database is still answering. Used by
    /// the health endpoint, so it must stay cheap and touch no collections.
    pub async fn ping(&self) -> Result<(), RepoError> {
        self.database.run_command(doc! { "ping": 1 }).await?;
        Ok(())
    }

    /// Drop the entire database. Used by tests and the seed reset path.
    pub async fn drop_database(&self) -> Result<(), RepoError> {
        self.database.drop().await?;
        Ok(())
    }

    /// Repository for the `packages` collection.
    #[must_use]
    pub fn packages(&self) -> PackageRepo {
        PackageRepo::new(self.database.collection("packages"))
    }

    /// Repository for the `bookings` collection.
    #[must_use]
    pub fn bookings(&self) -> BookingRepo {
        BookingRepo::new(self.database.collection("bookings"))
    }
}

/// True when a driver error is a duplicate-key (E11000) write error.
pub(crate) fn is_duplicate_key(err: &mongodb::error::Error) -> bool {
    use mongodb::error::{ErrorKind, WriteFailure};
    match err.kind.as_ref() {
        ErrorKind::Write(WriteFailure::WriteError(we)) => we.code == 11000,
        ErrorKind::InsertMany(ime) => ime
            .write_errors
            .as_ref()
            .is_some_and(|errs| errs.iter().any(|e| e.code == 11000)),
        _ => false,
    }
}
