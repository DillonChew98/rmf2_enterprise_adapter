# syntax=docker/dockerfile:1

# ── build ──────────────────────────────────────────────────────────────────
# edition 2024 needs a recent toolchain; rust:1-slim tracks the latest stable.
FROM rust:1-slim-bookworm AS builder
WORKDIR /app
# Copy the crate (lib + both bins) and the SQL that tiberius_repo compiles in
# via include_str!("../../sql/lims_jobs.sql").
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY sql ./sql
# Build the controller and the mock device (release, all-Rust TLS via rustls —
# no OpenSSL system libs needed).
RUN cargo build --release --bin rmf2_enterprise_adapter --bin mock_device

# ── runtime ────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime
# ca-certificates so TLS to SQL Server can validate the server chain.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/rmf2_enterprise_adapter /usr/local/bin/rmf2_enterprise_adapter
COPY --from=builder /app/target/release/mock_device /usr/local/bin/mock_device
# Runtime data files are read from the working directory.
COPY chemicals.txt ./chemicals.txt
ENV BIND_ADDR=0.0.0.0:7900
EXPOSE 7900
# Default: run the adapter. The mock-device compose service overrides this.
CMD ["rmf2_enterprise_adapter"]
