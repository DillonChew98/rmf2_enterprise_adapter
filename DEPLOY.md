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

> **Verified TLS with an internal CA.** If the LIMS uses a corporate/private CA
> (not a public one) and you want `MSSQL_TRUST_CERT=false`, drop the CA cert
> (PEM) in `certs/` and set `MSSQL_CA_CERT=/certs/<file>.pem` — it's mounted
> read-only into the adapter. `MSSQL_HOST` must match the cert's CN/SAN. See
> `certs/README.md`. Leave `MSSQL_TRUST_CERT=true` to skip verification entirely.

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

## Building behind a corporate proxy (TLS interception)

On a locked-down corporate network, a TLS-inspecting proxy re-signs HTTPS with an
**internal CA**. Inside the build containers that CA isn't trusted, so `cargo`
(crates.io) and `npm` (the registry) fail with errors like
`SSL peer certificate ... was not ok`. To fix it, supply the corporate CA to the
builds.

1. **Get the corporate root CA** as a PEM file (from IT, or exported from the
   Windows cert store / browser). Any filename is fine — you'll rename a copy.

2. **Place a copy named `corp-ca.pem` in BOTH build contexts** (the adapter and
   the UI are built separately, so it goes in two places):

   ```
   corp-ca.pem                        # repo root      -> adapter build
   modules/enterprise-ui/corp-ca.pem  # UI build context
   ```

   On Windows PowerShell, from the repo root (renaming a copy — the file's
   contents/certs are unchanged, only the name):

   ```powershell
   copy your-corp-bundle.pem corp-ca.pem
   copy your-corp-bundle.pem modules\enterprise-ui\corp-ca.pem
   ```

3. **Build normally:**
   ```bash
   docker compose build
   ```
   The adapter build appends the CA to its system trust store (cargo trusts it);
   the UI build points `NODE_EXTRA_CA_CERTS` at it (npm trusts it).

Notes:
- The file name **must be** `corp-ca.pem` — that's what the Dockerfiles look for.
- It's **optional**: with no `corp-ca.pem` present the builds are unchanged, so
  the same repo builds fine on an open network.
- `corp-ca.pem` is **git-ignored** — it's a per-site file, never committed.
- This CA is only for the **build** (reaching crates.io / npm through the proxy).
  It is unrelated to the **database** TLS, which is the separate
  `MSSQL_TRUST_CERT` / `MSSQL_CA_CERT` settings above.
- If the target machine itself can't reach registries, build the images on a
  machine that can and ship them (see "Air-gapped / offline install" below) —
  then the target needs neither the CA nor registry access.

## Air-gapped / offline install (build elsewhere, ship images)

For a target with no registry/internet access, build on a machine that has access
(with the corporate CA if needed), export the images to a file, and load them on
the target — no build, no registries, no CA needed on the target:

```bash
# On a machine that can build:
docker compose build
docker save rmf2-enterprise-adapter:latest rmf2-enterprise-ui:latest \
            mcr.microsoft.com/mssql/server:2022-latest eclipse-mosquitto:2 \
            -o rmf2-images.tar        # drop the last two if not using the demo

# Copy rmf2-images.tar + docker-compose.yaml + adapter.env to the target, then:
docker load -i rmf2-images.tar
docker compose up -d                  # runs the loaded images; nothing to pull
```

## Running on Windows (Windows 11 LTSC / Windows Server)

The whole stack runs on Windows with Docker — the images are Linux-based and run
transparently. Windows 11 LTSC is fine; nothing in the app changes. The `docker
compose` commands are identical, just run from **PowerShell / Windows Terminal**.

**1. Prerequisites**
- **WSL 2** — install from an admin PowerShell, then reboot:
  ```powershell
  wsl --install
  ```
  On **LTSC** there's no Microsoft Store, so if `wsl --install` can't fetch it,
  grab the WSL package from Microsoft's official WSL GitHub releases and install
  it manually, then `wsl --install -d Ubuntu`.
- **Virtualization must be enabled** — turn on VT-x/AMD-V in BIOS/UEFI and the
  *Virtual Machine Platform* + *WSL* Windows features. Verify:
  ```powershell
  wsl --status
  systeminfo | findstr /i "Hyper-V Virtualization"
  ```
- **Docker**, either:
  - **Docker Desktop** (WSL 2 backend) — simplest; auto-forwards published ports
    to the Windows host (LAN access works once the firewall is open). Check its
    licensing for larger orgs.
  - **Docker Engine inside a WSL 2 distro** (no Docker Desktop) — license-free,
    but needs an extra port-proxy step for LAN access (see below).

**2. Run it** (from the repo folder, in PowerShell)
```powershell
copy adapter.env.example adapter.env      # 'cp' also works in PowerShell
docker compose --profile demo up -d --build   # demo; or plain `up` for production
```
Then open `http://localhost:8080`. **No `sudo`** on Windows — Docker Desktop
handles permissions.

**3. Windows gotchas**
- **Line endings.** The `mssql-init` service runs a bash script embedded in
  `docker-compose.yaml`. If Git converts it to CRLF, that script fails. Keep
  `docker-compose.yaml`, `sql/*.sql`, `mosquitto.conf` and `chemicals.txt` as
  **LF**. Set this before cloning: `git config --global core.autocrlf false`
  (a `.gitattributes` with `* text=auto eol=lf` also guards it).
- **Put the repo inside the WSL filesystem** (`\\wsl$\Ubuntu\home\you\...` or work
  from a WSL terminal), **not** on `C:\` / `/mnt/c/...` — building on a
  Windows-mounted path is much slower.
- **Give Docker enough RAM.** The demo runs SQL Server, which wants ~2 GB. Set
  Docker Desktop → Settings → Resources to **at least 4 GB**.
- **Free ports.** `8080 / 7900 / 1433 / 1883` must not be in use on Windows.

**4. Let other PCs on the network reach the UI**
- Open the Windows firewall (admin PowerShell):
  ```powershell
  New-NetFirewallRule -DisplayName "Adapter UI 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
  ```
  (Add the same for `1883` if a real device connects to the bundled broker.)
- Others then browse to `http://<PC-LAN-IP>:8080` (find it with `ipconfig`). Only
  8080 needs to be reachable — nginx proxies `/api` internally.
- **Docker Engine in WSL 2 only:** published ports bind to the WSL VM, not the
  Windows LAN IP, so add a port-proxy on Windows:
  ```powershell
  netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=(wsl hostname -I)
  ```
  (Docker Desktop does this for you — nothing extra needed.)

## Building the adapter as a native Windows executable (for Windows Integrated Auth)

Only needed if the LIMS requires **Windows Integrated Authentication**
(`MSSQL_AUTH=integrated`) — the containerized (Linux) adapter can't use it, so the
adapter runs as a **native Windows service** under a domain account instead. (If
you have a **SQL login**, skip all of this — keep the Docker container and set
`MSSQL_AUTH=sql`.)

You build the `.exe` **once on any Windows machine** with Rust — NOT on the target.
The target then needs only the `.exe`, no toolchain.

1. **Install Rust (on the build machine, one-time)** — from rustup.rs, or:
   ```powershell
   winget install Rustlang.Rustup
   ```
   Uses the MSVC toolchain by default; if prompted, allow the Visual Studio C++
   Build Tools (the one prerequisite). Verify: `rustc --version`.

2. **Get the source** onto the build machine (`git clone`/`pull`, or copy the
   folder — needs `Cargo.toml`, `Cargo.lock`, `src/`, `sql/`, `chemicals.txt`).

3. **Behind the corporate proxy?** Point cargo at the CA first:
   ```powershell
   $env:CARGO_HTTP_CAINFO = "C:\path\to\corp-ca.pem"
   ```

4. **Build (release):**
   ```powershell
   cargo build --release --bin rmf2_enterprise_adapter
   ```
   Output: `target\release\rmf2_enterprise_adapter.exe`.

5. **Copy the `.exe` to the target** and register it as a Windows service running
   **as the domain service account** (so integrated auth works). Using NSSM:
   ```powershell
   nssm install rmf2-adapter "C:\rmf2\rmf2_enterprise_adapter.exe"
   nssm set rmf2-adapter AppDirectory "C:\rmf2"
   nssm set rmf2-adapter AppEnvironmentExtra LIMS_BACKEND=tiberius MSSQL_HOST=<server> MSSQL_PORT=<port> MSSQL_DATABASE=<db> MSSQL_AUTH=integrated BIND_ADDR=0.0.0.0:7900 MQTT_HOST=<broker>
   nssm set rmf2-adapter ObjectName "DOMAIN\svc_account" "<account password entered once>"
   nssm start rmf2-adapter
   ```
   The service authenticates to SQL Server **as that account** — no
   username/password in any file (`MSSQL_USER`/`MSSQL_PASSWORD` are ignored under
   `integrated`). Logs can be redirected to a file via NSSM; manage it in
   `services.msc`.

6. **Point the UI at the native adapter.** The UI (still in Docker) proxies `/api`
   to the adapter — change the proxy target in `modules/enterprise-ui/nginx.conf`
   from `adapter:7900` to `host.docker.internal:7900`, rebuild the UI image, and
   open Windows Firewall inbound on **7900**.

Notes:
- Running the `.exe` directly in a terminal shows a console window with the logs
  (good for a quick test; `Ctrl+C` stops it). As a **service** it runs headless in
  the background, auto-starts on boot, and needs no logged-in user.
- What IT must provide for this route: a **domain service account** with "log on
  as a service" rights and read access to the LIMS DB — no SQL login, no keytab.

## Common commands

```bash
docker compose ps                      # status
docker compose logs -f adapter         # adapter logs
docker compose logs -f ui              # UI / nginx logs
docker compose up -d --build adapter   # rebuild + restart just the adapter
docker compose down                    # stop everything (add -v to wipe the DB volume)
```

## Diagnosing LIMS / DB issues

Read the adapter logs — that's where every DB step is reported:

```bash
docker compose logs -f adapter
```
Make sure logging is on (default is fine, but explicit is safest): set `RUST_LOG=info`
in `adapter.env`.

**Healthy startup + a request looks like this:**
```
INFO  connected to LIMS (SQL Server)  host=... port=1433 database=LIMS user=...
INFO  LIMS schema check: OK  table="Entity"        (…EntityLinks, JobRecipeView, Job6Custom)
INFO  LIMS schema check: all expected tables and columns present
INFO  LIMS query returned 64 job(s)  count=64      ← logged on every /api/lims/jobs call
```

**Triage table** — find the log line you see and what it means:

| Log line | Meaning | Fix |
|---|---|---|
| `connected to LIMS (SQL Server)` then `schema check: OK` … `returned N job(s)` | All good. | — |
| `LIMS query returned 0 rows — connection + schema are fine but nothing matched…` | Connected, schema exists, but the query's **filters** matched nothing. | Check `Status IN ('A','P')`, `Type = 'SEM'`, and the entity-type/relationship IDs in `sql/lims_jobs.sql` against the customer's data. |
| `LIMS schema check: table NOT FOUND … table="Job6Custom"` | That **table/view doesn't exist** (or the login can't see it). | The customer's schema differs, or the login lacks `SELECT`. Adapt `sql/lims_jobs.sql`, or grant permission. |
| `LIMS schema check: table present but columns MISSING … missing_columns="XTime, Status"` | Table exists but a **column was renamed/removed**. | Update the column names in `sql/lims_jobs.sql`. |
| `GET /api/lims/jobs failed: … Invalid object name 'Job6Custom'` (or other SQL error) | The query **ran and errored** — the full SQL Server message is shown. | Act on the specific SQL error (bad object/column/syntax for this schema). |
| `Could not connect to the LIMS as SQL Server: … NOTE: this adapter speaks ONLY Microsoft SQL Server …` | **Can't connect at all** — wrong host/port, firewall, bad login, or **the DB isn't SQL Server** (e.g. PostgreSQL/MySQL). | Verify host/port/login/firewall. If the LIMS is a different engine, that needs a new `LimsRepository` implementation (a code change), not just config. |

Notes:
- The **schema check runs once at startup**; the **row-count logs on every request** (the UI
  polls `/api/lims/jobs` ~every 5 s, so you'll see `returned N job(s)` repeatedly).
- Errors are also returned to the UI in the API response body (`{"error": "LIMS query failed: …"}`),
  so a failed lookup shows the reason on screen too.
- Quick manual check from the host: `curl http://localhost:7900/api/lims/jobs`.

## Notes

- Change host ports in `docker-compose.yaml` if 8080 / 7900 are taken
  (`"8080:80"` → `"<host>:80"`).
- Put a TLS terminator (nginx / Caddy / cloud LB) in front of the `ui` service
  for HTTPS in production.
- The `mock-device` service is for the demo only; a real machine connects to the
  broker on its own.
