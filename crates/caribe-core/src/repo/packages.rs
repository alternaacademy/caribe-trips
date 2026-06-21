//! Package persistence: BSON document mapping + CRUD.

use futures::TryStreamExt;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::{doc, to_bson, Document};
use mongodb::Collection;
use serde::{Deserialize, Serialize};

use super::RepoError;
use crate::models::{price_from, Departure, Destination, NewPackage, Package, UpdatePackage};

/// Stored shape of a package: same fields as [`Package`] but with a real
/// `ObjectId` `_id`. Internal to the repo.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PackageDoc {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    id: Option<ObjectId>,
    title: String,
    destination: Destination,
    hero_image: String,
    gallery: Vec<String>,
    short_pitch: String,
    description_md: String,
    included: Vec<String>,
    not_included: Vec<String>,
    departures: Vec<Departure>,
    price_from: u32,
    featured: bool,
}

impl From<PackageDoc> for Package {
    fn from(d: PackageDoc) -> Self {
        Self {
            id: d.id.map(|o| o.to_hex()),
            title: d.title,
            destination: d.destination,
            hero_image: d.hero_image,
            gallery: d.gallery,
            short_pitch: d.short_pitch,
            description_md: d.description_md,
            included: d.included,
            not_included: d.not_included,
            departures: d.departures,
            price_from: d.price_from,
            featured: d.featured,
        }
    }
}

/// Build a storable doc from a create/update payload, deriving `price_from`.
fn doc_from_payload(p: NewPackage, id: Option<ObjectId>) -> PackageDoc {
    let price_from = price_from(&p.departures);
    PackageDoc {
        id,
        title: p.title,
        destination: p.destination,
        hero_image: p.hero_image,
        gallery: p.gallery,
        short_pitch: p.short_pitch,
        description_md: p.description_md,
        included: p.included,
        not_included: p.not_included,
        departures: p.departures,
        price_from,
        featured: p.featured,
    }
}

/// Filters for [`PackageRepo::list`].
#[derive(Debug, Clone, Default)]
pub struct PackageFilter {
    /// Restrict to one destination.
    pub destination: Option<Destination>,
    /// Case-insensitive substring match on title / short pitch.
    pub q: Option<String>,
}

/// CRUD over the `packages` collection. Methods take/return domain models.
pub struct PackageRepo {
    coll: Collection<PackageDoc>,
}

impl PackageRepo {
    pub(super) fn new(coll: Collection<PackageDoc>) -> Self {
        Self { coll }
    }

    /// List packages matching `filter`, sorted by soonest price ascending then
    /// title.
    pub async fn list(&self, filter: PackageFilter) -> Result<Vec<Package>, RepoError> {
        let mut query = Document::new();
        if let Some(dest) = filter.destination {
            query.insert("destination", to_bson(&dest)?);
        }
        if let Some(q) = filter.q {
            let q = q.trim();
            if !q.is_empty() {
                let pattern = regex::escape(q);
                query.insert(
                    "$or",
                    vec![
                        doc! { "title": { "$regex": &pattern, "$options": "i" } },
                        doc! { "shortPitch": { "$regex": &pattern, "$options": "i" } },
                    ],
                );
            }
        }
        let cursor = self
            .coll
            .find(query)
            .sort(doc! { "priceFrom": 1, "title": 1 })
            .await?;
        let docs: Vec<PackageDoc> = cursor.try_collect().await?;
        Ok(docs.into_iter().map(Package::from).collect())
    }

    /// Fetch one package by hex id. Unknown/malformed id → [`RepoError::NotFound`].
    pub async fn get(&self, id: &str) -> Result<Package, RepoError> {
        let oid = ObjectId::parse_str(id).map_err(|_| RepoError::NotFound)?;
        self.coll
            .find_one(doc! { "_id": oid })
            .await?
            .map(Package::from)
            .ok_or(RepoError::NotFound)
    }

    /// Insert a new package; `price_from` is derived from its departures.
    pub async fn create(&self, payload: NewPackage) -> Result<Package, RepoError> {
        let mut doc = doc_from_payload(payload, None);
        let res = self.coll.insert_one(&doc).await?;
        let oid = res.inserted_id.as_object_id().ok_or(RepoError::NotFound)?;
        doc.id = Some(oid);
        Ok(doc.into())
    }

    /// Replace an existing package (PUT semantics). Re-derives `price_from`.
    pub async fn update(&self, id: &str, payload: UpdatePackage) -> Result<Package, RepoError> {
        let oid = ObjectId::parse_str(id).map_err(|_| RepoError::NotFound)?;
        let doc = doc_from_payload(payload, Some(oid));
        let res = self.coll.replace_one(doc! { "_id": oid }, &doc).await?;
        if res.matched_count == 0 {
            return Err(RepoError::NotFound);
        }
        Ok(doc.into())
    }

    /// Delete a package by id. Unknown id → [`RepoError::NotFound`].
    pub async fn delete(&self, id: &str) -> Result<(), RepoError> {
        let oid = ObjectId::parse_str(id).map_err(|_| RepoError::NotFound)?;
        let res = self.coll.delete_one(doc! { "_id": oid }).await?;
        if res.deleted_count == 0 {
            return Err(RepoError::NotFound);
        }
        Ok(())
    }
}
