//! Runtime configuration, loaded from the environment with sensible defaults
//! matching `.env.example`.

/// Server configuration.
#[derive(Debug, Clone)]
pub struct Config {
    /// MongoDB connection string.
    pub mongodb_uri: String,
    /// MongoDB database name.
    pub mongodb_db: String,
    /// Address the HTTP server binds to (e.g. `0.0.0.0:8080`).
    pub api_bind: String,
    /// Primary browser origin allowed by CORS (the Vite dev server).
    pub web_origin: String,
    /// Optional second allowed origin, e.g. a LAN IP for on-device Android.
    pub extra_origin: Option<String>,
}

impl Config {
    /// Read configuration from the environment, falling back to dev defaults.
    pub fn from_env() -> Self {
        Self {
            mongodb_uri: env_or("MONGODB_URI", "mongodb://localhost:27017"),
            mongodb_db: env_or("MONGODB_DB", "caribe_trips"),
            api_bind: env_or("API_BIND", "0.0.0.0:8080"),
            web_origin: env_or("WEB_ORIGIN", "http://localhost:5173"),
            extra_origin: std::env::var("CORS_EXTRA_ORIGIN")
                .ok()
                .filter(|s| !s.is_empty()),
        }
    }

    /// All browser origins CORS should allow.
    pub fn allowed_origins(&self) -> Vec<String> {
        let mut origins = vec![self.web_origin.clone()];
        if let Some(extra) = &self.extra_origin {
            origins.push(extra.clone());
        }
        origins
    }
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key)
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| default.to_string())
}
