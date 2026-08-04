# syntax=docker/dockerfile:1

# ── build ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Optional corporate CA — only needed behind a TLS-inspecting proxy where npm
# can't verify the registry. Drop the PEM as `corp-ca.pem` in the build context;
# without it an empty file is used (a harmless no-op). Node reads its own CA
# bundle (not the system store), so it's pointed here via NODE_EXTRA_CA_CERTS.
COPY corp-ca.pe[m] /tmp/
RUN if [ -f /tmp/corp-ca.pem ]; then cp /tmp/corp-ca.pem /usr/local/share/corp-ca.pem; \
    else : > /usr/local/share/corp-ca.pem; fi
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/corp-ca.pem

COPY package.json package-lock.json* ./
# `npm install` (not `npm ci`) so platform-specific native deps (@tailwindcss/oxide,
# @rollup/rollup-*) resolve correctly for the build platform — `npm ci` can crash
# on these when the lockfile was generated on a different OS.
RUN npm install --no-audit --no-fund
COPY . .
# Vite reads .env.production (VITE_USE_MOCK=false, same-origin API) at build.
RUN npm run build

# ── serve ──────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
