# syntax=docker/dockerfile:1

# ── build ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
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
