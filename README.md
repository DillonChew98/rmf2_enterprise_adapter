# rmf2_enterprise_adapter

A Rust **Device Controller** (RMF2 terms) for the delayering machine: it bridges the
**LIMS** (SQL Server) into the RMF2 ecosystem and serves the operator UI. Architecturally
mirrors `rmf2_device_manager/modules/device-registry` (Axum, `config`, `state.rs`, `api/` with
the `ApiResult`/`error_response` pattern, permissive CORS).

- **Adapter (Rust):** repo root crate (`src/`).
- **Operator UI (React):** `modules/enterprise-ui/`.

## Data source is interchangeable

The LIMS sits behind the async `LimsRepository` trait (`src/lims/repository.rs`). The
REST/RMF2-facing code depends only on the trait, so the backing driver swaps freely:

- `TiberiusLimsRepository` — real **SQL Server** via the `tiberius` driver, running the user's
  **verbatim T-SQL** (`sql/lims_jobs.sql`). Going live against the real LIMS is just a
  connection-string change.
- `MockLimsRepository` — in-memory seed, runs with no database (`LIMS_BACKEND=mock`).

(`sqlx` is intentionally not used: it doesn't support MS SQL Server, which the real LIMS is.)

## Device link (MQTT)

The delayering machine is a separate process (`mock_device` binary) that speaks the RMF2 device
contract over **MQTT** — mirroring `rmf2_device_manager`'s `door-mqtt-device-controller` ↔ mock
device:

```
mock_device  ──MQTT device/v1/<mfr>/<id>/{connection,state,request}──►  adapter (controller)  ──REST──►  UI
```

- The **device** publishes `connection` (heartbeat) + `state` (1 Hz), and consumes `request`.
- The **controller** (`MqttDevice`, behind the `Device` trait) subscribes to `connection`/`state`,
  caches them, and publishes a submitted job on `request`.
- Execution is **deterministic** (no random status): the device steps through the job's chemistry
  (or cleaning/dispensing) and reports real status. **While running a job it rejects new jobs.**
- The controller exposes this to the UI over **REST** for now (AMQP is a later pass).
- The device also **owns its mix recipes**: it publishes them (retained) on a `…/mixes`
  topic and consumes saves on `…/mixes/save`, persisting to `mix_presets.json`. The controller
  caches + relays them via `/api/mix-presets`.

## REST API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness. |
| GET | `/api/lims/jobs` | Open SEM jobs (runs the LIMS query). |
| GET | `/api/lims/jobs/{jobNumber}` | Single job lookup. |
| GET | `/api/chemicals` | Selectable chemical catalog (file-backed). |
| GET | `/api/mix-presets` | The device's saved mix recipes. |
| POST | `/api/mix-presets` | Ask the device to save a new mix recipe. |
| GET | `/api/machine/state` | Live device status (drives the Dashboard). |
| GET | `/api/machine/connection` | Device ONLINE / OFFLINE / CONNECTION_BROKEN. |
| POST | `/api/machine/request` | Submit a job → `202` accepted, `409` busy, `503` offline. |
| GET | `/api/machine/request/previous` | Most recently accepted job. |
| GET | `/api/machine/request` | All accepted jobs. |

A submitted job is one of three mutually-exclusive `jobType`s: `CHEMICAL_PROCESS`
(up to 5 steps, each single-chemical or mix + method + duration), `BEAKER_CLEANING`, or
`CHEMICAL_DISPENSING`. Submitted jobs are held in memory for now (the LIMS stays read-only);
a future AMQP sink will publish them onto `device.v1.*.request`.

## Config (env / `.env`)

| Var | Default | Notes |
|---|---|---|
| `LIMS_BACKEND` | `tiberius` | `tiberius` or `mock`. |
| `MSSQL_HOST` / `MSSQL_PORT` | `localhost` / `1433` | |
| `MSSQL_DATABASE` | `LIMS` | |
| `MSSQL_USER` / `MSSQL_PASSWORD` | `sa` / `Your_strong_Pass123` | |
| `MSSQL_TRUST_CERT` | `true` | Trust the dev container's self-signed cert. |
| `BIND_ADDR` | `0.0.0.0:7900` | The UI's `VITE_API_URL` points here. |
| `MQTT_HOST` / `MQTT_PORT` | `localhost` / `1883` | Broker for the device link. |
| `MACHINE_MANUFACTURER` / `MACHINE_DEVICE_ID` | `acme-delayer` / `delayer-01` | Device identity / topics. |
| `CHEMICALS_FILE` | `chemicals.txt` | Chemical catalog source (one per line; built-in if missing). |

## Run the full stack

Four pieces: SQL Server (LIMS) + an MQTT broker + the mock device + the controller, plus the UI.

```bash
cp .env.example .env

# 1. SQL Server (seeded LIMS). Wait for "LIMS mock ready":
docker compose up -d
#    docker logs enterprise-adapter-mssql-init
#    Need a broker too? If nothing is on :1883:  docker compose --profile broker up -d
#    (If you already have an MQTT broker on :1883, it's used automatically.)

# 2. Mock delayering device (separate terminal):
cargo run --bin mock_device

# 3. Controller / adapter (separate terminal):
cargo run                       # :7900, tiberius backend + MQTT device link
curl localhost:7900/api/machine/state
curl localhost:7900/api/lims/jobs

# 4. UI (separate terminal):
cd modules/enterprise-ui && npm install && npm run dev   # http://localhost:5174
```

Run with **no database**: `LIMS_BACKEND=mock cargo run`. Point at the **real LIMS** by skipping
the seed and setting `MSSQL_*` — the query is unchanged.

## Layout

```
src/
  lib.rs             shared crate (api, config, device, jobs, lims, state)
  main.rs            controller binary: config -> repos/device -> router(+CORS) -> bind
  bin/mock_device.rs the delayering machine: MQTT pub connection/state, sub request, executor
  config.rs          Config::from_env (LIMS backend + mssql + mqtt + bind)
  state.rs           AppState { lims, jobs, device } (all trait objects)
  lims/              model, repository (trait), tiberius_repo, mock_repo
  jobs/              model (jobType-discriminated), store (trait), memory_store
  device/            model, device (trait), mqtt_device (controller), executor, topics
  catalog/           model (Chemical), catalog (trait), static_catalog (file-backed)
  api/               errors, lims, jobs, machine, catalog
sql/                 lims_jobs.sql (verbatim T-SQL), 0001_schema.sql, 0002_seed.sql
chemicals.txt        editable chemical catalog (one per line)
docker-compose.yaml  SQL Server (+ seed) + Mosquitto broker
mosquitto.conf       anonymous broker config
```
