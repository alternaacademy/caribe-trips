//! Free-text intent in, one recommended package plus two alternatives out.
//!
//! The model only ever *chooses*: it returns catalog positions, which are
//! re-checked here, and every rendered price/date/title comes from Mongo. A
//! hallucination therefore cannot become a wrong commercial offer.

use std::time::Duration;

use caribe_core::Package;
use chrono::Datelike;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::config::Config;

/// Every field is `required` — the model silently drops optional ones.
/// Choices are 1-based catalog positions rather than Mongo ids: a 24-char hex id
/// costs ~12 tokens, and at ~8 tok/s three of them added ~4 s per call.
fn response_schema() -> serde_json::Value {
    json!({
        "type": "object",
        "properties": {
            "pick":           { "type": "integer" },
            "headline":       { "type": "string" },
            "why":            { "type": "string" },
            "considerations": { "type": "string" },
            "alsoConsider":   { "type": "array", "items": { "type": "integer" } },
            "fits":           { "type": "boolean" },
            "confidence":     { "type": "number" }
        },
        "required": ["pick", "headline", "why", "considerations", "alsoConsider", "fits", "confidence"]
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelChoice {
    pick: i64,
    headline: String,
    why: String,
    #[serde(default)]
    considerations: String,
    #[serde(default)]
    also_consider: Vec<i64>,
    /// The model's escape hatch. Without it the schema forces a pick, so a
    /// request nothing in the catalog satisfies still comes back as a confident
    /// recommendation.
    #[serde(default = "yes")]
    fits: bool,
    #[serde(default)]
    confidence: f64,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub package: Package,
    pub headline: String,
    pub why: String,
    pub considerations: String,
    pub also_consider: Vec<Package>,
    /// False when nothing in the catalog genuinely answers the request. The
    /// pick is still the closest option; the UI reframes it rather than
    /// presenting it as a match.
    pub fits: bool,
    /// The model's own confidence, surfaced so the UI can soften its framing
    /// instead of presenting a shaky pick as a firm recommendation.
    pub confidence: f64,
    pub model: String,
    pub elapsed_ms: u64,
}

/// Every variant degrades the UI to plain browsing, never an error page.
#[derive(Debug)]
pub enum ConciergeError {
    Disabled,
    Unreachable(String),
    /// The model was reachable but took longer than `OLLAMA_TIMEOUT_MS`.
    TimedOut,
    BadResponse(String),
    UngroundedChoice(i64),
}

impl std::fmt::Display for ConciergeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConciergeError::Disabled => write!(f, "concierge is disabled"),
            ConciergeError::Unreachable(m) => write!(f, "model unreachable: {m}"),
            ConciergeError::TimedOut => write!(f, "model timed out"),
            ConciergeError::BadResponse(m) => write!(f, "unusable model response: {m}"),
            ConciergeError::UngroundedChoice(n) => {
                write!(f, "model chose catalog position {n}, which does not exist")
            }
        }
    }
}

/// Register: unspecified, the model reaches for street slang ("mi hermano").
/// Length: at ~8 tok/s an unbounded sentence costs real seconds — the character
/// limits below took a measured answer from 268 tokens to 194.
const SYSTEM_PROMPT: &str = "\
Eres el asesor de viajes de Caribe Trips, una agencia dominicana.
Elige UNA experiencia del catálogo que mejor encaje con lo que cuenta el viajero,
y luego dos alternativas distintas.

Reglas:
- Elige solo por el número de la lista. `pick` y `alsoConsider` son números del catálogo.
- `alsoConsider`: exactamente dos números, distintos al principal.
- Español neutro y cálido, trato de usted. Sin jerga ni modismos callejeros.
- No inventes precios, fechas ni servicios: usa solo lo que aparece en el catálogo.
- `headline`: máximo 60 caracteres.
- `why`: máximo 180 caracteres, una sola oración, sin repetir lo que dijo el viajero.
- `considerations`: máximo 120 caracteres, una sola oración honesta sobre duración,
  presupuesto o esfuerzo.
- `fits`: true solo si alguna opción cumple de verdad lo que pidió el viajero.
  Ponlo en false si pide un destino, una fecha, un presupuesto o un tipo de viaje
  que el catálogo no ofrece, o si el mensaje no habla de viajar. En ese caso igual
  elige lo más cercano y explica en `considerations` qué no se cumple.";

const MONTHS: [&str; 12] = [
    "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

/// One line per package, numbered from 1 to match `pick`.
///
/// Departures collapse to distinct months. Listing every ISO date cost ~40
/// tokens per package — across the catalog that was several seconds of
/// prompt-eval to express "this runs in August".
fn catalog_block(packages: &[Package]) -> String {
    packages
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let mut months: Vec<&str> = Vec::new();
            for d in &p.departures {
                let m = MONTHS[d.date.month0() as usize];
                if !months.contains(&m) {
                    months.push(m);
                }
            }
            format!(
                "{n}) \"{title}\" | {dest:?} | RD${price} | {pitch} | {months}",
                n = i + 1,
                title = p.title,
                dest = p.destination,
                price = p.price_from,
                pitch = p.short_pitch,
                months = months.join("/"),
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Ask the model to pick, then re-hydrate its choices from `packages`.
pub async fn recommend(
    config: &Config,
    packages: &[Package],
    intent: &str,
) -> Result<Recommendation, ConciergeError> {
    if !config.concierge_enabled {
        return Err(ConciergeError::Disabled);
    }
    if packages.is_empty() {
        return Err(ConciergeError::BadResponse("empty catalog".into()));
    }

    let body = json!({
        "model": config.ollama_model,
        "stream": false,
        // Thinking model: left on, it spends the whole budget in `thinking`
        // and returns an empty `content`.
        "think": false,
        "format": response_schema(),
        // num_ctx is explicit: Ollama's default silently truncates a prompt
        // that outgrows it, which would drop catalog entries without any error.
        "options": { "temperature": 0.3, "num_predict": 600, "num_ctx": 8192 },
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": format!(
                "CATÁLOGO:\n{}\n\nEL VIAJERO ESCRIBE:\n{}",
                catalog_block(packages),
                intent
            ) }
        ]
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(config.ollama_timeout_ms))
        .build()
        .map_err(|e| ConciergeError::Unreachable(e.to_string()))?;

    let started = std::time::Instant::now();
    let resp = client
        .post(format!("{}/api/chat", config.ollama_url.trim_end_matches('/')))
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                ConciergeError::TimedOut
            } else {
                ConciergeError::Unreachable(e.to_string())
            }
        })?;

    if !resp.status().is_success() {
        return Err(ConciergeError::Unreachable(format!(
            "ollama returned {}",
            resp.status()
        )));
    }

    let envelope: serde_json::Value = resp.json().await.map_err(|e| {
        if e.is_timeout() {
            ConciergeError::TimedOut
        } else {
            ConciergeError::BadResponse(e.to_string())
        }
    })?;
    let content = envelope
        .pointer("/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    if content.trim().is_empty() {
        return Err(ConciergeError::BadResponse("empty content".into()));
    }
    let choice: ModelChoice =
        serde_json::from_str(content).map_err(|e| ConciergeError::BadResponse(e.to_string()))?;

    let at = |n: i64| {
        usize::try_from(n)
            .ok()
            .and_then(|n| n.checked_sub(1))
            .and_then(|i| packages.get(i))
            .cloned()
    };

    // Unknown secondaries are dropped rather than failing the whole response.
    let package = at(choice.pick).ok_or(ConciergeError::UngroundedChoice(choice.pick))?;
    let also_consider: Vec<Package> = choice
        .also_consider
        .iter()
        .filter(|n| **n != choice.pick)
        .filter_map(|n| at(*n))
        .take(2)
        .collect();

    Ok(Recommendation {
        package,
        headline: choice.headline,
        why: choice.why,
        considerations: choice.considerations,
        also_consider,
        fits: choice.fits,
        confidence: choice.confidence.clamp(0.0, 1.0),
        model: config.ollama_model.clone(),
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use caribe_core::{Departure, Destination};

    fn pkg(id: &str, title: &str) -> Package {
        Package {
            id: Some(id.to_string()),
            title: title.to_string(),
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
        }
    }

    #[test]
    fn catalog_block_numbers_entries_from_one() {
        let block = catalog_block(&[pkg("abc", "Escapada"), pkg("def", "Saona")]);
        assert!(block.starts_with("1) \"Escapada\""), "got {block}");
        assert!(block.contains("2) \"Saona\""), "got {block}");
        assert!(block.contains("RD$1000"), "got {block}");
        // Months, not full ISO dates — the long form cost prompt-eval seconds.
        assert!(block.contains("ago"), "got {block}");
        assert!(!block.contains("2026-08-09"), "got {block}");
    }

    #[test]
    fn schema_requires_every_field_we_read() {
        let schema = response_schema();
        let required = schema["required"].as_array().unwrap();
        for field in ["pick", "headline", "why", "considerations", "alsoConsider"] {
            assert!(
                required.iter().any(|v| v == field),
                "{field} must be required"
            );
        }
    }
}
