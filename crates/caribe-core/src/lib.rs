//! Caribe Trips core domain crate.
//!
//! The single source of truth for the backend's domain types: packages,
//! bookings, and the enums/DTOs that cross the API boundary. Wire JSON is
//! camelCase (see `models`); validation and small domain helpers live here too.

pub mod models;
pub mod repo;
pub mod seed;
pub mod validation;

pub use models::{
    compute_total, generate_booking_code, price_from, Booking, BookingStatus, Contact, Departure,
    Destination, DomainError, NewBooking, NewPackage, Package, UpdatePackage,
};
pub use repo::{Db, PackageFilter, RepoError};
pub use seed::{seed, SeedMode, SeedOutcome};
pub use validation::{validate_new_booking, validate_new_package};
