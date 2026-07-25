//! Caribe Trips API binary.
//!
//! Boots the Axum server (config from env, Mongo connection, indexes, seed) or,
//! with the `seed` subcommand, seeds the database and exits.

use anyhow::Context;
use caribe_api::app;
use caribe_api::config::Config;
use caribe_api::state::AppState;
use caribe_core::{seed, Db, SeedMode};
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "caribe-api", about = "Caribe Trips REST API")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Seed the database with sample data, then exit.
    Seed {
        /// Drop and rebuild the fixture set instead of seeding only-if-empty.
        #[arg(long)]
        reset: bool,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let cli = Cli::parse();
    let config = Config::from_env();

    let db = Db::connect(&config.mongodb_uri, &config.mongodb_db)
        .await
        .context("connecting to MongoDB")?;
    db.ensure_indexes().await.context("ensuring indexes")?;

    if let Some(Command::Seed { reset }) = cli.command {
        let mode = if reset {
            SeedMode::Reset
        } else {
            SeedMode::IfEmpty
        };
        let outcome = seed(&db, mode).await.context("seeding")?;
        tracing::info!(?outcome, "seed complete");
        println!(
            "seed: inserted={} packages={} bookings={}",
            outcome.inserted, outcome.packages, outcome.bookings
        );
        return Ok(());
    }

    // Normal startup: seed if empty, then serve.
    let outcome = seed(&db, SeedMode::IfEmpty).await.context("startup seed")?;
    tracing::info!(?outcome, "startup seed");

    let state = AppState {
        db,
        config: std::sync::Arc::new(config.clone()),
    };
    let router = app::router(state, &config);

    let listener = tokio::net::TcpListener::bind(&config.api_bind)
        .await
        .with_context(|| format!("binding {}", config.api_bind))?;
    tracing::info!("caribe-api listening on http://{}", config.api_bind);
    axum::serve(listener, router).await.context("serving")?;
    Ok(())
}

/// Initialize tracing; honor `RUST_LOG`, default to `info`.
fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info,caribe_api=debug"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();
}
