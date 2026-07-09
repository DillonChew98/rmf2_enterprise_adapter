# Deployment

The stack ships as two container images built by `docker compose`:

| Service   | Image                        | Port  | What it is                                   |
|-----------|------------------------------|-------|----------------------------------------------|
| `adapter` | `rmf2-enterprise-adapter`    | 7900  | Rust controller — LIMS + device REST API     |
| `ui`      | `rmf2-enterprise-ui`         | 8080  | Operator UI (static build served by nginx)   |

The UI's nginx **reverse-proxies `/api` to the adapter**, so the browser only
talks to the UI's origin — no CORS, and no backend hostname baked into the image.

## 1. Configure the LIMS connection

All adapter settings live in one file. Copy the template and edit it:

```bash
cp adapter.env.example adapter.env
```

Point it at your real LIMS (and broker/machine) for production:

```ini
LIMS_BACKEND=tiberius
MSSQL_HOST=lims.corp.local
MSSQL_PORT=1433
MSSQL_DATABASE=LIMS
MSSQL_USER=svc_adapter
MSSQL_PASSWORD=********
MSSQL_TRUST_CERT=false      # verify a real CA cert in prod
MQTT_HOST=broker.corp.local # the machine's MQTT broker / gateway
```

`adapter.env` is git-ignored — keep secrets there, never in the image.

> Going live is exactly this file change: swap `MSSQL_*` (and `MQTT_*`) to the
> real hosts. Nothing in the code or images changes — the LIMS sits behind the
> `LimsRepository` trait.

## 2a. Production (connect to your real LIMS / broker / machine)

```bash
docker compose up -d --build      # builds + starts `adapter` and `ui` only
```

- UI:      http://<host>:8080
- Adapter: http://<host>:7900  (e.g. `curl http://<host>:7900/api/lims/jobs`)

## 2b. Self-contained demo (no external systems)

Brings up SQL Server (seeded), an MQTT broker, and a simulated machine too:

```bash
cp adapter.env.example adapter.env   # demo defaults already point at the bundled services
docker compose --profile demo up -d --build
```

The demo `adapter.env` uses `MSSQL_HOST=mssql` and `MQTT_HOST=mosquitto` (the
compose service names), so it works out of the box.

> The adapter connects to SQL Server at startup; if the DB isn't seeded yet the
> container restarts until it is (a few seconds). `restart: unless-stopped`
> handles this automatically.

## Common commands

```bash
docker compose ps                      # status
docker compose logs -f adapter         # adapter logs
docker compose logs -f ui              # UI / nginx logs
docker compose up -d --build adapter   # rebuild + restart just the adapter
docker compose down                    # stop everything (add -v to wipe the DB volume)
```

## Notes

- Change host ports in `docker-compose.yaml` if 8080 / 7900 are taken
  (`"8080:80"` → `"<host>:80"`).
- Put a TLS terminator (nginx / Caddy / cloud LB) in front of the `ui` service
  for HTTPS in production.
- The `mock-device` service is for the demo only; a real machine connects to the
  broker on its own.
