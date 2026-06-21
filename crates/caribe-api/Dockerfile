# Multi-stage build of the Caribe Trips API.
# `cargo build --release` builds only the workspace default-members
# (caribe-core + caribe-api) — the Tauri mobile crate is never compiled.
FROM rust:1-bookworm AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates
RUN cargo build --release --bin caribe-api

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/caribe-api /usr/local/bin/caribe-api
EXPOSE 8080
# Seeds-if-empty on startup, then serves. Config comes from the environment.
CMD ["caribe-api"]
