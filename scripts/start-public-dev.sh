#!/usr/bin/env bash
# Keep https://dev.steamx.cc healthy via local next + steamx-dev tunnel.
#
# Prefer `next dev --webpack` (NOT turbo, NOT next start):
# - User wants the local-dev experience exposed through the tunnel.
# - Cloudflare tunnel + turbopack HMR historically leaves AuthProvider loading=true.
# - Webpack HMR is more tunnel-tolerant; if HMR still flakes, preview/login/video win.
#
# Never kill cloudflared. Never touch production.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd /workspace/STEAMx

set -a
# shellcheck disable=SC1091
source .env.local
set +a

PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"
LOG="${LOG:-/tmp/steamx-next-dev.log}"

is_up() {
  curl -fsS -m 2 "http://${HOST}:${PORT}/api/health" >/dev/null 2>&1
}

is_webpack_dev() {
  pgrep -af "next dev --webpack" >/dev/null 2>&1 \
    || pgrep -af "next/dist/bin/next dev --webpack" >/dev/null 2>&1
}

# Stop production server on :3000 (keep tunnel alive).
stop_prod() {
  pkill -f 'next start' 2>/dev/null || true
  # next-server is started by `next start`; only kill if webpack-dev is not the goal process yet
  if ! is_webpack_dev; then
    pkill -f 'next-server' 2>/dev/null || true
  fi
  sleep 1
}

# Stop turbopack/other next-dev variants that break Auth over the tunnel.
stop_bad_dev() {
  pkill -f 'next.dev --turbo' 2>/dev/null || true
  pkill -f 'next/dist/bin/next.dev --turbo' 2>/dev/null || true
  # bare `next dev` without --webpack (often turbo by package.json "dev")
  if pgrep -af 'next.dev' >/dev/null 2>&1 && ! is_webpack_dev; then
    pkill -f 'next/dist/bin/next.dev' 2>/dev/null || true
    pkill -f 'next.dev --port' 2>/dev/null || true
  fi
  sleep 1
}

if is_up && is_webpack_dev; then
  echo "webpack next-dev already healthy on :${PORT}"
else
  stop_bad_dev
  stop_prod
  # free port if something else still holds it
  if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
    sleep 1
  fi
  nohup pnpm exec next dev --webpack -H "${HOST}" -p "${PORT}" >"${LOG}" 2>&1 &
  echo "started next dev --webpack pid=$! log=${LOG}"
  for i in $(seq 1 90); do
    is_up && break
    sleep 1
  done
fi

if ! is_up; then
  echo "health check failed — last log:" >&2
  tail -n 40 "${LOG}" >&2 || true
  exit 1
fi

if ! pgrep -f 'cloudflared tunnel .* run steamx-dev' >/dev/null 2>&1; then
  nohup cloudflared tunnel --config "$HOME/.cloudflared/config.yml" run steamx-dev \
    >/tmp/cloudflared-steamx-dev.log 2>&1 &
  echo "started cloudflared pid=$!"
else
  echo "cloudflared steamx-dev already running"
fi

curl -fsS -m 20 "https://dev.steamx.cc/api/health"
echo
echo "ok: local next dev --webpack → ${HOST}:${PORT} → tunnel → https://dev.steamx.cc"
