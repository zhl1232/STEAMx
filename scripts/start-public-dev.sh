#!/usr/bin/env bash
# Keep https://dev.steamx.cc healthy.
# IMPORTANT: serve with `next start` (production), NOT `next dev`.
# Cloudflare tunnel + next dev breaks Turbopack HMR websockets and leaves
# AuthProvider loading=true forever (header spinner, no 登录 button).
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd /workspace/STEAMx

set -a
# shellcheck disable=SC1091
source .env.local
set +a

need_build=0
if [[ ! -f .next/BUILD_ID ]]; then
  need_build=1
fi

# Prefer production server on :3000
is_prod_up() {
  curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1
}

# Detect a live next-dev (bad for the public tunnel). Match turbo/webpack deliberately.
if pgrep -f 'next.dev( --turbo| --port| )' >/dev/null 2>&1 || pgrep -f 'next.dev$' >/dev/null 2>&1; then
  # Only kill next-dev workers, never next start / next-server from prod.
  pkill -f 'next.dev --turbo' 2>/dev/null || true
  pkill -f 'next.dev --port' 2>/dev/null || true
  # fallback: node .../next/dist/bin/next.dev
  pkill -f 'next/dist/bin/next.dev' 2>/dev/null || true
  echo "stopped next.dev if it was running"
  sleep 2
fi

if [[ "$need_build" -eq 1 ]]; then
  echo "no .next build — running pnpm build"
  pnpm build
fi

if ! is_prod_up; then
  # clear anything still bound to 3000
  pkill -f 'next start' || true
  pkill -f 'next-server' || true
  sleep 1
  nohup pnpm start > /tmp/steamx-pnpm-start.log 2>&1 &
  echo "started pnpm start pid=$!"
  for i in $(seq 1 60); do
    is_prod_up && break
    sleep 1
  done
fi

if ! pgrep -f 'cloudflared tunnel .* run steamx-dev' >/dev/null 2>&1; then
  nohup cloudflared tunnel --config "$HOME/.cloudflared/config.yml" run steamx-dev > /tmp/cloudflared-steamx-dev.log 2>&1 &
  echo "started cloudflared pid=$!"
fi

curl -fsS -m 15 https://dev.steamx.cc/api/health
echo
