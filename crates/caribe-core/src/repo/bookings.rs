//! Booking persistence: BSON document mapping + create/list/confirm.

use chrono::{DateTime, NaiveDate, Utc};
use futures::TryStreamExt;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::{doc, to_bson, Document};
use mongodb::options::ReturnDocument;
use mongodb::Collection;
use serde::{Deserialize, Serialize};

use super::{is_duplicate_key, RepoError};
use crate::models::{Booking, BookingStatus, Contact};

/// Stored shape of a booking: same fields as [`Booking`] but with a real
/// `ObjectId` `_id`. Internal to the repo.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct BookingDoc {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    id: Option<ObjectId>,
    code: String,
    package_id: String,
    departure_date: NaiveDate,
    people: u32,
    total: u32,
    contact: Contact,
    status: BookingStatus,
    created_at: DateTime<Utc>,
}

impl From<BookingDoc> for Booking {
    fn from(d: BookingDoc) -> Self {
        Self {
            id: d.id.map(|o| o.to_hex()),
            code: d.code,
            package_id: d.package_id,
            departure_date: d.departure_date,
            people: d.people,
            total: d.total,
            contact: d.contact,
            status: d.status,
            created_at: d.created_at,
        }
    }
}

impl From<&Booking> for BookingDoc {
    fn from(b: &Booking) -> Self {
        Self {
            id: None,
            code: b.code.clone(),
            package_id: b.package_id.clone(),
            departure_date: b.departure_date,
            people: b.people,
            total: b.total,
            contact: b.contact.clone(),
            status: b.status,
            created_at: b.created_at,
        }
    }
}

/// CRUD over the `bookings` collection. Methods take/return domain models.
pub struct BookingRepo {
    coll: Collection<BookingDoc>,
}

impl BookingRepo {
    pub(super) fn new(coll: Collection<BookingDoc>) -> Self {
        Self { coll }
    }

    /// Persist a fully-formed booking. A clashing `code` → [`RepoError::DuplicateCode`].
    pub async fn create(&self, booking: Booking) -> Result<Booking, RepoError> {
        let mut doc = BookingDoc::from(&booking);
        match self.coll.insert_one(&doc).await {
            Ok(res) => {
                let oid = res.inserted_id.as_object_id().ok_or(RepoError::NotFound)?;
                doc.id = Some(oid);
                Ok(doc.into())
            }
            Err(e) if is_duplicate_key(&e) => Err(RepoError::DuplicateCode),
            Err(e) => Err(e.into()),
        }
    }

    /// List bookings, optionally filtered by `status`, newest first.
    pub async fn list(&self, status: Option<BookingStatus>) -> Result<Vec<Booking>, RepoError> {
        let mut query = Document::new();
        if let Some(status) = status {
            query.insert("status", to_bson(&status)?);
        }
        let cursor = self.coll.find(query).sort(doc! { "createdAt": -1 }).await?;
        let docs: Vec<BookingDoc> = cursor.try_collect().await?;
        Ok(docs.into_iter().map(Booking::from).collect())
    }

    /// Look up a booking by its human `code`.
    pub async fn get_by_code(&self, code: &str) -> Result<Booking, RepoError> {
        self.coll
            .find_one(doc! { "code": code })
            .await?
            .map(Booking::from)
            .ok_or(RepoError::NotFound)
    }

    /// Fetch a booking by hex id. Unknown/malformed id → [`RepoError::NotFound`].
    pub async fn get(&self, id: &str) -> Result<Booking, RepoError> {
        let oid = ObjectId::parse_str(id).map_err(|_| RepoError::NotFound)?;
        self.coll
            .find_one(doc! { "_id": oid })
            .await?
            .map(Booking::from)
            .ok_or(RepoError::NotFound)
    }

    /// Flip a `Pendiente` booking to `Confirmada`. Not repeatable: a booking
    /// that is already confirmed → [`RepoError::AlreadyConfirmed`]; an unknown
    /// id → [`RepoError::NotFound`].
    pub async fn confirm(&self, id: &str) -> Result<Booking, RepoError> {
        let oid = ObjectId::parse_str(id).map_err(|_| RepoError::NotFound)?;
        let updated = self
            .coll
            .find_one_and_update(
                doc! { "_id": oid, "status": "Pendiente" },
                doc! { "$set": { "status": "Confirmada" } },
            )
            .return_document(ReturnDocument::After)
            .await?;
        match updated {
            Some(doc) => Ok(doc.into()),
            None => {
                // Distinguish "no such booking" from "already confirmed".
                match self.get(id).await {
                    Ok(_) => Err(RepoError::AlreadyConfirmed),
                    Err(e) => Err(e),
                }
            }
        }
    }
}
