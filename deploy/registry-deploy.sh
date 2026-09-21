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
backup_dir="$(mktemp -d)"
candidate_compose="${CANDIDATE_COMPOSE_FILE:-}"
candidate_nginx="${CANDIDATE_NGINX_FILE:-}"
nginx_site_path="${NGINX_SITE_PATH:-/etc/nginx/sites-available/steam-app}"
nginx_site_enabled_path="${NGINX_SITE_ENABLED_PATH:-/etc/nginx/sites-enabled/steam-app}"
config_changed=0
cleanup() {
  rm -rf "$login_config" "$candidate_env" "$rollback_env"
  if [ "$config_changed" -eq 0 ]; then rm -rf "$backup_dir"; fi
}
on_exit() {
  local status=$?
  if [ "$status" -ne 0 ] && [ "$config_changed" -eq 1 ]; then
    if ! restore_configs; then
      echo "Configuration restore failed; backups retained at $backup_dir" >&2
    fi
  fi
  cleanup
  return "$status"
}
trap on_exit EXIT
export DOCKER_CONFIG="$login_config"
unset STEAM_APP_IMAGE # The selected env file must win over an inherited override.

cd "$app_dir"

compose_help="$(docker compose up --help 2>&1)"
if ! grep -q -- '--wait' <<<"$compose_help" || ! grep -q -- '--wait-timeout' <<<"$compose_help"; then
  echo 'This Docker Compose version must support --wait and --wait-timeout.' >&2
  exit 1
fi

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USERNAME" --password-stdin >/dev/null
echo "Pulling $image_ref ..."
docker pull "$image_ref"

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

if [ -f .env ]; then
  awk '!/^STEAM_APP_IMAGE=/' .env >"$rollback_env"
else
  : >"$rollback_env"
fi
if [ -n "$previous_image" ]; then
  printf 'STEAM_APP_IMAGE=%s\n' "$previous_image" >>"$rollback_env"
fi

compose() {
  local env_file="$1"
  shift
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

run_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo -n "$@"; fi
}

backup_entry() {
  local path="$1" name="$2" privileged="${3:-0}" target
  if [ -L "$path" ]; then
    if [ "$privileged" = 1 ]; then target="$(run_root readlink "$path")"; else target="$(readlink "$path")"; fi
    printf 'symlink\n%s\n' "$target" >"$backup_dir/$name.kind"
  elif [ -e "$path" ]; then
    printf 'file\n' >"$backup_dir/$name.kind"
    if [ "$privileged" = 1 ]; then run_root cp -a -- "$path" "$backup_dir/$name"; else cp -a -- "$path" "$backup_dir/$name"; fi
  else
    printf 'absent\n' >"$backup_dir/$name.kind"
  fi
}

restore_entry() {
  local path="$1" name="$2" privileged="${3:-0}" kind target
  local -a command_prefix=()
  if [ "$privileged" = 1 ]; then command_prefix=(run_root); fi
  kind="$(sed -n '1p' "$backup_dir/$name.kind")" || return 1
  "${command_prefix[@]}" rm -f -- "$path" || return 1
  if [ "$kind" = file ]; then
    "${command_prefix[@]}" mkdir -p -- "$(dirname "$path")" || return 1
    "${command_prefix[@]}" cp -a -- "$backup_dir/$name" "$path" || return 1
  elif [ "$kind" = symlink ]; then
    target="$(sed -n '2p' "$backup_dir/$name.kind")" || return 1
    "${command_prefix[@]}" mkdir -p -- "$(dirname "$path")" || return 1
    "${command_prefix[@]}" ln -s -- "$target" "$path" || return 1
  fi
}

backup_configs() {
  if [ -n "$candidate_compose" ]; then backup_entry "$compose_file" compose; fi
  if [ -n "$candidate_nginx" ]; then
    backup_entry "$nginx_site_path" nginx-site 1
    if [ "$nginx_site_enabled_path" != "$nginx_site_path" ]; then
      backup_entry "$nginx_site_enabled_path" nginx-enabled 1
    fi
  fi
}

install_configs() {
  if [ -n "$candidate_compose" ]; then
    rm -f -- "$compose_file"
    cp -- "$candidate_compose" "$compose_file"
  fi
  if [ -n "$candidate_nginx" ]; then
    run_root mkdir -p -- "$(dirname "$nginx_site_path")"
    run_root rm -f -- "$nginx_site_path"
    run_root cp -f -- "$candidate_nginx" "$nginx_site_path"
    if [ "$nginx_site_enabled_path" != "$nginx_site_path" ]; then
      run_root mkdir -p -- "$(dirname "$nginx_site_enabled_path")"
      run_root rm -f -- "$nginx_site_enabled_path"
      run_root ln -s -- "$nginx_site_path" "$nginx_site_enabled_path"
    fi
  fi
}

restore_configs() {
  local failed=0
  if [ -n "$candidate_compose" ] && [ -f "$backup_dir/compose.kind" ]; then
    restore_entry "$compose_file" compose || failed=1
  fi
  if [ -n "$candidate_nginx" ] && [ -f "$backup_dir/nginx-site.kind" ]; then
    restore_entry "$nginx_site_path" nginx-site 1 || failed=1
    if [ "$nginx_site_enabled_path" != "$nginx_site_path" ]; then
      restore_entry "$nginx_site_enabled_path" nginx-enabled 1 || failed=1
    fi
  fi
  if [ "$failed" -ne 0 ]; then return 1; fi
  config_changed=0
}

if [ -n "$candidate_compose$candidate_nginx" ]; then
  backup_configs
  config_changed=1
  install_configs
  if [ -n "$candidate_nginx" ] && ! run_root nginx -t; then
    restore_configs
    echo 'Deployment failed; nginx configuration validation failed.' >&2
    exit 1
  fi
fi

if compose "$candidate_env" up -d --force-recreate --no-build --pull never --wait --wait-timeout "$wait_timeout"; then
  if [ -n "$candidate_nginx" ] && ! run_root systemctl reload nginx; then
    restore_configs
    if [ -n "$previous_image" ]; then
      if compose "$rollback_env" up -d --force-recreate --no-build --pull never --wait --wait-timeout "$wait_timeout"; then
        mv -f "$rollback_env" "$image_env_file"
      else
        echo 'Deployment failed and rollback health check failed.' >&2
      fi
    else
      echo 'Deployment failed; no running steam-app image was found for rollback.' >&2
    fi
    exit 1
  fi
  mv -f "$candidate_env" "$image_env_file"
  config_changed=0
  exit 0
fi

restore_configs
if [ -n "$previous_image" ]; then
  if compose "$rollback_env" up -d --force-recreate --no-build --pull never --wait --wait-timeout "$wait_timeout"; then
    mv -f "$rollback_env" "$image_env_file"
  else
    echo 'Deployment failed and rollback health check failed.' >&2
  fi
else
  echo 'Deployment failed; no running steam-app image was found for rollback.' >&2
fi
exit 1
