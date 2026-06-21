//! HTTP resource routes mounted under `/api`.

pub mod bookings;
pub mod packages;

use serde_json::Value;

use crate::error::ApiError;

/// Parse a query-string enum value (e.g. a destination or status) using the
/// domain type's serde representation, returning a 400 on an unknown value.
fn parse_enum<T: serde::de::DeserializeOwned>(field: &str, value: &str) -> Result<T, ApiError> {
    serde_json::from_value::<T>(Value::String(value.to_string()))
        .map_err(|_| ApiError::Validation(format!("invalid {field}: {value}")))
}
