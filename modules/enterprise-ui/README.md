# enterprise-ui

Operator console for the **delayering machine**, the front end of the RMF2
`rmf2_enterprise_adapter`. Mirrors the stack and conventions of
`rmf2_device_manager/modules/device-ui` (React 19 + Vite + Tailwind 4 +
TypeScript, Feature-Sliced Design).

The delayering machine is modelled as an RMF2 device (`deviceType: "machine"`):

- `connection` → machine online/offline
- `state` → the **Dashboard** fields
- `request` → a submitted delayering **job** (the **Job Input** tab)

## Tabs

- **Dashboard** — live machine status (system status, current job, cycle time,
  error code, chemical level, process/beaker-cleaning status, alarm, all
  sensors, job date/time). Polls every 1.5 s.
- **Job Input** — pick a LIMS job (pre-fills read-only LIMS fields), complete
  the operator inputs, and submit. Chemical process is **single chemicals** or
  a **mix** (max 3 reagents at a ratio, e.g. `1:1 HCl+HNO3`) — mutually
  exclusive. Method is Ultrasonic / Heated plate / Etching. "Copy previous job"
  reuses the last submission's operator inputs.
- **Users** — mock RBAC. Roles (Operator / Supervisor / Admin) gate actions;
  switch the active role from the header.

## Mock vs real adapter

Runs entirely on an in-browser mock by default. The entity `api` modules branch
on `VITE_USE_MOCK`; set it to `false` (and point `VITE_API_URL` at the adapter)
to talk to the real `rmf2_enterprise_adapter` REST API:
`GET /api/machine/state`, `GET /api/machine/connection`, `GET /api/lims/jobs`,
`POST /api/machine/request`, `GET /api/users`.

## Develop

```
npm install
npm run dev        # http://localhost:5174
npm run typecheck
npm run build
```

### Troubleshooting

If the build fails with `@tailwindcss/oxide` "Cannot find native binding", npm
skipped the platform-specific binary (a known npm optional-deps bug, more common
on Node < 20). Install it explicitly for your platform, e.g. on linux x64:

```
npm i --no-save @tailwindcss/oxide-linux-x64-gnu
```

