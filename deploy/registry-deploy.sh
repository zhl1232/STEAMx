#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy an already-built immutable image. The caller supplies the compose file
# in /opt/steam-app and the registry coordinates through environment variables.
: "${IMAGE_DIGEST:?IMAGE_DIGEST is required}"
: "${GHCR_USERNAME:?GHCR_USERNAME is required}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required}"
: "${REGISTRY_IMAGE:?REGISTRY_IMAGE is required}"

app_dir="${APP_DIR:-/opt/steam-app}"
compose_file="${COMPOSE_FILE:-$app_dir/docker-compose.yml}"
image_env_file="${IMAGE_ENV_FILE:-$app_dir/.env}"
wait_timeout="${COMPOSE_WAIT_TIMEOUT:-120}"
image_ref="${REGISTRY_IMAGE}@${IMAGE_DIGEST}"
login_config="$(mktemp -d)"
candidate_env="$(mktemp "${image_env_file}.new.XXXXXX")"
rollback_env="$(mktemp "${image_env_file}.rollback.XXXXXX")"
cleanup() {
  rm -rf "$login_config" "$candidate_env" "$rollback_env"
}
trap cleanup EXIT
export DOCKER_CONFIG="$login_config"
unset STEAM_APP_IMAGE # The selected env file must win over an inherited override.

cd "$app_dir"

compose_help="$(docker compose up --help 2>&1)"
if ! grep -q -- '--wait' <<<"$compose_help" || ! grep -q -- '--wait-timeout' <<<"$compose_help"; then
  echo 'This Docker Compose version must support --wait and --wait-timeout.' >&2
  exit 1
fi

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USERNAME" --password-stdin >/dev/null
docker pull "$image_ref" >/dev/null

# Compose's implicit .env is also used for interpolation. Copy it into the
# candidate env file so --env-file preserves the existing interpolation settings.
if [ -f .env ]; then
  awk '!/^STEAM_APP_IMAGE=/' .env >"$candidate_env"
else
  : >"$candidate_env"
fi
printf 'STEAM_APP_IMAGE=%s\n' "$image_ref" >>"$candidate_env"

previous_image=""
if previous_image_id="$(docker inspect -f '{{if .State.Running}}{{.Image}}{{end}}' steam-app 2>/dev/null)" && [ -n "$previous_image_id" ]; then
  # Keep an exact local reference to the image that was serving before the
  # switch. It remains available for rollback even when its registry tag moves.
  previous_image='steam-app:rollback'
  docker tag "$previous_image_id" "$previous_image"
fi

compose() {
  local env_file="$1"
  shift
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

if compose "$candidate_env" up -d --force-recreate --no-build --pull never --wait --wait-timeout "$wait_timeout"; then
  mv -f "$candidate_env" "$image_env_file"
  exit 0
fi

if [ -n "$previous_image" ]; then
  if [ -f .env ]; then
    awk '!/^STEAM_APP_IMAGE=/' .env >"$rollback_env"
  else
    : >"$rollback_env"
  fi
  printf 'STEAM_APP_IMAGE=%s\n' "$previous_image" >>"$rollback_env"
  if compose "$rollback_env" up -d --force-recreate --no-build --pull never --wait --wait-timeout "$wait_timeout"; then
    mv -f "$rollback_env" "$image_env_file"
  else
    echo 'Deployment failed and rollback health check failed.' >&2
  fi
else
  echo 'Deployment failed; no running steam-app image was found for rollback.' >&2
fi
exit 1
