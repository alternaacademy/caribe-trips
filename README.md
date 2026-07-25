# Caribe Trips

A small travel-agency MVP: customers browse and book trip packages; agency staff confirm
manual payments and manage packages from a backoffice. One React SPA (also wrappable as an
Android app) talks to a Rust/Axum API over MongoDB.

- **Customer app** — Spanish brochure UI (English routes): home listing grouped by month with a
  *Destacados* strip, an **AI concierge** that turns free text into a recommendation, destination
  filters, package brochure, booking flow, and a confirmation screen with manual-payment
  instructions.
- **Agent backoffice** (`/agent`) — a dense, calm tool: bookings worklist with a "Confirmar pago"
  flow, and package CRUD with a two-pane markdown editor + live brochure preview.

## Stack

| Layer     | Choice |
|-----------|--------|
| Frontend  | React 18 + TypeScript + Vite, React Router, TanStack Query, plain CSS (token-based), react-hook-form, react-markdown |
| Backend   | Rust + Axum (tokio), MongoDB (official driver) |
| DB        | MongoDB via docker-compose |
| Android   | Tauri 2 wraps the built SPA into an APK (`crates/mobile`); native shell (tab bar, offline states, Mis reservas) gated to the Android build |
| Tooling   | Cargo workspace + pnpm workspace, `just`, Biome (JS/TS), rustfmt/clippy |

## Repo layout

```
Cargo.toml                  # Rust workspace (resolver 2)
crates/
  caribe-core/              # domain models, validation, Mongo repo, seed, TS type-gen
  caribe-api/               # Axum server (lib + bin)
packages/
  web/                      # React SPA (customer + agent), Playwright E2E
docker-compose.yml          # MongoDB (+ mongo-express under the `tools` profile)
justfile                    # task runner (see below)
notes/                      # design docs, stack, plan, per-task specs (notes/tasks/00-INDEX.md)
```

## Prerequisites

- **Rust** (stable; `rust-toolchain.toml` pins it with rustfmt + clippy)
- **Node** + **pnpm**
- **Docker** (for MongoDB via compose)
- For the Android build (Task 22): Android SDK/NDK + JDK + the Tauri CLI — see
  [notes/MOBILE.md](notes/MOBILE.md). Not required for web/API development.

## Quickstart — the whole stack, one command

```sh
docker compose up --build      # MongoDB + API + web app
```

That builds and starts everything; the API seeds sample data on first run. Open:

- **Customer app:** <http://localhost:5173>
- **Agent backoffice:** <http://localhost:5173/agent>

Stop with `docker compose down` (keeps data) or `docker compose down -v` (wipes it). If ports
`27017` / `8080` / `5173` are taken locally, create a `.env` with `MONGO_PORT` / `API_PORT` /
`WEB_PORT` overrides (docker compose reads it automatically) and re-run.

### Alternative — host-side dev (hot reload)

For fast iteration, run Mongo in compose and the API + web on the host:

```sh
pnpm install && cargo build
just up                                            # MongoDB only
just seed                                          # 6 packages + 6 bookings
cargo run -p caribe-api                            # API on :8080 (seeds-if-empty)
cp packages/web/.env.example packages/web/.env     # VITE_API_BASE_URL=http://localhost:8080/api
pnpm --filter web dev                              # web on :5173 (hot reload)
```

## Environment variables

API (`.env.example` at repo root):

| Var | Default | Purpose |
|-----|---------|---------|
| `MONGODB_URI` | `mongodb://localhost:27017` | Mongo connection string |
| `MONGODB_DB` | `caribe_trips` | database name |
| `API_BIND` | `0.0.0.0:8080` | API listen address |
| `WEB_ORIGIN` | `http://localhost:5173` | allowed CORS origin (the SPA) |
| `CORS_EXTRA_ORIGIN` | — | optional second CORS origin (e.g. a LAN IP for on-device Android) |
| `OLLAMA_URL` / `OLLAMA_MODEL` | see "AI concierge" | local model backing `/api/recommend` |
| `MONGO_PORT` / `MONGO_EXPRESS_PORT` | `27017` / `8081` | host ports docker-compose publishes |

Web (`packages/web/.env`): `VITE_API_BASE_URL` (default `http://localhost:8080/api`).

## `just` recipes

| Recipe | Does |
|--------|------|
| `just fmt` / `just lint` / `just check` | format / lint / check both toolchains |
| `just up` / `just up-tools` / `just down` / `just down-hard` | MongoDB (+ mongo-express) lifecycle |
| `just seed` | drop + reinsert the sample data |
| `just dev` | run the API |
| `just gen-types` | regenerate `packages/web/src/api/types.ts` from the Rust models |
| `just build` | release build (cargo + web) |
| `just e2e` | full-stack Playwright happy-path against an isolated, reset-seeded DB |
| `just android-dev` / `just android-build` | Tauri Android (requires the Android toolchain — Task 22) |

## AI concierge

The home search box is a free-text field: travelers describe the trip they want (budget, who's
coming, how much effort) and a **local Gemma via Ollama** picks one experience from the catalog
plus two smaller alternatives.

The model only ever *chooses*. It is handed a numbered catalog and returns positions; the server
re-checks each one and re-hydrates the real package from MongoDB, so every price, date and title
on screen comes from the database and never from the model.

```
browser ──POST /api/recommend──▶ caribe-api ──/api/chat──▶ ollama (gemma4:31b)
```

| Var | Default | Purpose |
|-----|---------|---------|
| `OLLAMA_URL` | `http://gauss.icefish-vector.ts.net:11434` | Ollama base URL |
| `OLLAMA_MODEL` | `gemma4:31b` | model used for recommendations |
| `OLLAMA_TIMEOUT_MS` | `60000` | hard per-request timeout |
| `CONCIERGE_ENABLED` | `true` | kill switch; `false` makes the endpoint report unavailable |

When nothing in the catalog answers the request — a trip to Japan, a budget no package
meets — the model sets `fits: false` and the UI reframes the panel as *"nada encaja del
todo"*, still offering the closest option instead of a dead end. Without that field the
schema forces a pick, so an impossible request came back as a confident wrong answer.

A recommendation takes **~16 s** on the reference machine (an RTX-class desktop reachable over
Tailscale), so the request is explicit — never debounce-on-type — and the UI shows a skeleton
while it runs. If Ollama is unreachable the endpoint returns **503** and the page degrades to
plain browsing (destination chips + grid) rather than showing an error. Unreachable, timed
out and unusable-answer are distinct codes (`concierge_unavailable` / `concierge_timeout` /
`concierge_confused`) so a slow model doesn't read like an unplugged one, and a long wait
shows an elapsed counter with a **Cancelar** button.

Edge cases are tested without a model on either side:
`crates/caribe-api/tests/concierge_faults.rs` drives the server against a stub Ollama on a
real socket (unreachable, slow, empty content, unparseable, invented package), and
`packages/web/e2e/concierge-states.spec.ts` intercepts `/api/recommend` to assert each UI
state. Neither suite needs Ollama running.

Two things are load-bearing and easy to regress: the request must send `"think": false`
(`gemma4:31b` otherwise spends its whole token budget in a `thinking` field and returns empty
content), and every field the server reads must be listed as `required` in the JSON schema, since
the model silently omits optional ones.

Use the tailnet **FQDN**, not the short host name — containers resolve through Docker's own
resolver, which has no tailnet search domain, so `http://gauss:11434` fails from inside compose.

## Testing

- **Rust unit tests**: `cargo test` (domain models, validation, seed shape).
- **Rust integration tests** (gated on `MONGODB_TEST_URI`, hermetic by default):
  `just up && MONGODB_TEST_URI=mongodb://localhost:27017 cargo test`.
- **Web unit tests** (formatters, month grouping): `pnpm --filter web test` (vitest).
- **End-to-end smoke** (web + API + Mongo): `just e2e`. Uses an isolated `caribe_trips_e2e`
  database and a reset seed per run; covers the core journey (book → agent-confirm → create a
  package that shows on Home). This is a *smoke* test, not exhaustive coverage.

`MONGO_PORT` / `MONGODB_URI` are overridable everywhere if `27017` is already taken locally.

## Android (Tauri 2)

The same built SPA is wrapped as an Android app via Tauri 2 (`crates/mobile`). The native shell —
bottom tab bar (Inicio · Buscar · Mis reservas), offline/error/skeleton states, pull-to-refresh, and
a device-local "Mis reservas" list — lives in `packages/web/src/mobile/` and is gated behind
`isMobileShell()` (so the plain web app is unaffected; force it in a browser with `?mobile=1`).
`crates/mobile` is intentionally outside the workspace `default-members`, so a normal `cargo build`
never needs the Android toolchain.

### Toolchain (one-time)

JDK 17, the Android SDK (platform 34 + build-tools 34 + platform-tools), NDK r26b, the Rust Android
targets, and the Tauri CLI:

```sh
# JDK 17, SDK + NDK go anywhere writable; export these (e.g. in your shell profile):
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=$HOME/Android/Sdk
export NDK_HOME=$ANDROID_HOME/ndk/26.1.10909125
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" "ndk;26.1.10909125"
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
cargo install tauri-cli --version "^2"
```

The Android project (`crates/mobile/gen/android`) is generated by `cargo tauri android init`
(rerun if it is missing). App id `com.caribetrips.app`.

### Build / run

```sh
# Point the SPA at a device-reachable API (the device can't reach the host's
# localhost): emulator → http://10.0.2.2:8080/api ; physical device → your LAN IP.
# Set it in packages/web/.env, and add that origin to the API CORS allow-list
# (WEB_ORIGIN / CORS_EXTRA_ORIGIN).
just android-build   # → crates/mobile/gen/android/app/build/outputs/apk/.../app-universal-debug.apk
just android-dev     # run on a connected device/emulator with live reload
```

The Tauri WebView serves the app from `http://tauri.localhost`, so allow that origin on the API for
on-device fetches. More native-specialization notes: [notes/MOBILE.md](notes/MOBILE.md). Status-bar
theming + splash polish remain device-side follow-ups (Tasks 23 notes).

## Docs

Design and planning live in [`notes/`](notes/): `STACK.md`, `PLAN.md`, `DESIGN.md`,
`BACKOFFICE.md`, `MOBILE.md`, and per-task specs under [`notes/tasks/`](notes/tasks/)
(start at [`notes/tasks/00-INDEX.md`](notes/tasks/00-INDEX.md)). Issue tracking uses **bd (beads)**.

## Later (out of MVP)

Auth on `/agent/*` · real payment gateway · image upload · CI pipeline · referential cleanup when
deleting a package referenced by bookings.
