# Caribe Trips — task runner
# `just` with no args lists recipes.
default:
    @just --list

# Format both toolchains (Rust + JS/TS).
fmt:
    cargo fmt
    pnpm run fmt

# Lint both toolchains.
lint:
    cargo clippy --all-targets -- -D warnings
    pnpm run lint

# Type/compile check both toolchains.
check:
    cargo check --all-targets
    pnpm install --frozen-lockfile=false
    pnpm run check

# Build release artifacts.
build:
    cargo build --release
    pnpm -r --if-present build

# Run API + web dev servers (wired up in later tasks).
dev:
    cargo run -p caribe-api

# Seed the database with sample data (drop + rebuild).
seed:
    cargo run -p caribe-api -- seed --reset

# Regenerate packages/web/src/api/types.ts from the Rust wire models.
gen-types:
    cargo run -p caribe-core --example gen-types --features schema

# Full-stack happy-path E2E (Playwright) against an isolated, reset-seeded DB.
# MONGODB_URI is overridable (default mongodb://localhost:27017).
e2e:
    docker compose up -d --wait mongo
    cargo build -p caribe-api
    MONGODB_DB=caribe_trips_e2e cargo run -p caribe-api -- seed --reset
    pnpm --filter web exec playwright test

# ── Android (Tauri 2) ──────────────────────────────────────────────────────
# Requires the Android SDK/NDK + JDK 17 + Tauri CLI on PATH. Set up once and
# source the env (ANDROID_HOME, NDK_HOME, JAVA_HOME) — see README "Android".
# For a device/emulator, build the web with a reachable VITE_API_BASE_URL
# (emulator → http://10.0.2.2:8080/api ; device → your machine's LAN IP).

# Run the app on a connected device/emulator with live reload.
android-dev:
    cd crates/mobile && cargo tauri android dev

# Build a debug APK (all architectures). Output under
# crates/mobile/gen/android/app/build/outputs/apk/.
android-build:
    cd crates/mobile && cargo tauri android build --debug --apk

# Bring the WHOLE stack up (MongoDB + API + web) — one command.
stack:
    docker compose up -d --build

# Tear the whole stack down (volume retained).
stack-down:
    docker compose down

# Bring the observability stack up (Elasticsearch + Kibana + Filebeat).
observability:
    docker compose --profile observability up -d

# Create the Kibana data view (idempotent; needs the stack up).
kibana-setup:
    ./observability/setup-kibana.sh

# Tear the observability stack down (volumes retained).
observability-down:
    docker compose --profile observability down

# Bring only MongoDB up (for host-side API/web dev).
up:
    docker compose up -d mongo

# Bring MongoDB + mongo-express admin UI (http://localhost:8081) up.
up-tools:
    docker compose --profile tools up -d

# Tear infrastructure down (volume retained).
down:
    docker compose down

# Tear infrastructure down and DROP the data volume.
down-hard:
    docker compose down -v
