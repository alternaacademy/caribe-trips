//! Domain validation for the create/update DTOs.
//!
//! These guard the API boundary (Tasks 07/08) before anything touches Mongo.
//! Email checking is a deliberately loose shape check, not RFC-perfect.

use std::sync::LazyLock;

use regex::Regex;

use crate::models::{Departure, DomainError, NewBooking, NewPackage, Package};

/// Allowed party size for a single booking.
const MAX_PEOPLE: u32 = 12;

/// Loose email shape: `local@domain.tld`, no whitespace, a dot in the domain.
static EMAIL_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").unwrap());

/// Validate a booking request against the package it targets.
///
/// Checks party size (1..=12), required contact fields, email shape, and that
/// the chosen `departure_date` is actually offered by `package`.
pub fn validate_new_booking(booking: &NewBooking, package: &Package) -> Result<(), DomainError> {
    if booking.people < 1 || booking.people > MAX_PEOPLE {
        return Err(DomainError::InvalidPeople(booking.people));
    }
    if booking.contact.name.trim().is_empty() {
        return Err(DomainError::EmptyName);
    }
    if booking.contact.phone.trim().is_empty() {
        return Err(DomainError::EmptyPhone);
    }
    if !EMAIL_RE.is_match(booking.contact.email.trim()) {
        return Err(DomainError::InvalidEmail(booking.contact.email.clone()));
    }
    let offered = package
        .departures
        .iter()
        .any(|d| d.date == booking.departure_date);
    if !offered {
        return Err(DomainError::DepartureNotFound(booking.departure_date));
    }
    Ok(())
}

/// Validate a package create/update payload: non-empty title, at least one
/// departure, and every departure priced above zero.
pub fn validate_new_package(package: &NewPackage) -> Result<(), DomainError> {
    if package.title.trim().is_empty() {
        return Err(DomainError::EmptyTitle);
    }
    if package.departures.is_empty() {
        return Err(DomainError::NoDepartures);
    }
    if package.departures.iter().any(|d: &Departure| d.price == 0) {
        return Err(DomainError::InvalidPrice);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::*;
    use crate::models::{Contact, Destination, Package};

    fn d(y: i32, m: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, day).unwrap()
    }

    fn package_with_departures(departures: Vec<Departure>) -> Package {
        Package {
            id: Some("x".to_string()),
            title: "T".to_string(),
            destination: Destination::PuntaCana,
            hero_image: String::new(),
            gallery: vec![],
            short_pitch: String::new(),
            description_md: String::new(),
            included: vec![],
            not_included: vec![],
            departures,
            price_from: 0,
            featured: false,
        }
    }

    fn booking(people: u32, name: &str, email: &str, date: NaiveDate) -> NewBooking {
        NewBooking {
            package_id: "x".to_string(),
            departure_date: date,
            people,
            contact: Contact {
                name: name.to_string(),
                phone: "809-555-0100".to_string(),
                email: email.to_string(),
            },
        }
    }

    #[test]
    fn accepts_a_valid_booking() {
        let pkg = package_with_departures(vec![Departure {
            date: d(2026, 6, 14),
            price: 100,
        }]);
        let nb = booking(2, "María", "m@x.do", d(2026, 6, 14));
        assert!(validate_new_booking(&nb, &pkg).is_ok());
    }

    #[test]
    fn rejects_bad_party_size() {
        let pkg = package_with_departures(vec![Departure {
            date: d(2026, 6, 14),
            price: 100,
        }]);
        assert_eq!(
            validate_new_booking(&booking(0, "A", "a@b.co", d(2026, 6, 14)), &pkg),
            Err(DomainError::InvalidPeople(0))
        );
        assert_eq!(
            validate_new_booking(&booking(13, "A", "a@b.co", d(2026, 6, 14)), &pkg),
            Err(DomainError::InvalidPeople(13))
        );
    }

    #[test]
    fn rejects_empty_name_and_bad_email() {
        let pkg = package_with_departures(vec![Departure {
            date: d(2026, 6, 14),
            price: 100,
        }]);
        assert_eq!(
            validate_new_booking(&booking(1, "   ", "a@b.co", d(2026, 6, 14)), &pkg),
            Err(DomainError::EmptyName)
        );
        for bad in ["plainaddress", "no@dot", "a b@x.co", "@x.co", "a@"] {
            assert!(
                matches!(
                    validate_new_booking(&booking(1, "A", bad, d(2026, 6, 14)), &pkg),
                    Err(DomainError::InvalidEmail(_))
                ),
                "expected {bad:?} to be rejected"
            );
        }
    }

    #[test]
    fn rejects_departure_not_in_package() {
        let pkg = package_with_departures(vec![Departure {
            date: d(2026, 6, 14),
            price: 100,
        }]);
        assert_eq!(
            validate_new_booking(&booking(1, "A", "a@b.co", d(2026, 8, 1)), &pkg),
            Err(DomainError::DepartureNotFound(d(2026, 8, 1)))
        );
    }

    #[test]
    fn validates_new_package_rules() {
        let good = NewPackage {
            title: "Viaje".to_string(),
            destination: Destination::Samana,
            hero_image: String::new(),
            gallery: vec![],
            short_pitch: String::new(),
            description_md: String::new(),
            included: vec![],
            not_included: vec![],
            departures: vec![Departure {
                date: d(2026, 6, 14),
                price: 100,
            }],
            featured: false,
        };
        assert!(validate_new_package(&good).is_ok());

        let mut empty_title = good.clone();
        empty_title.title = "  ".to_string();
        assert_eq!(
            validate_new_package(&empty_title),
            Err(DomainError::EmptyTitle)
        );

        let mut no_dep = good.clone();
        no_dep.departures = vec![];
        assert_eq!(
            validate_new_package(&no_dep),
            Err(DomainError::NoDepartures)
        );

        let mut zero_price = good.clone();
        zero_price.departures = vec![Departure {
            date: d(2026, 6, 14),
            price: 0,
        }];
        assert_eq!(
            validate_new_package(&zero_price),
            Err(DomainError::InvalidPrice)
        );
    }
}
