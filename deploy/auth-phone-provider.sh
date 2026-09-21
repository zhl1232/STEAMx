#!/usr/bin/env bash
set -Eeuo pipefail

provider="${AUTH_PHONE_PROVIDER:-legacy}"
verified="${SUPABASE_VERIFIED:-false}"
app_dir="${APP_DIR:-/opt/steam-app}"
compose_file="${COMPOSE_FILE:-$app_dir/docker-compose.yml}"
env_file="${ENV_FILE:-$app_dir/.env.production}"
wait_timeout=120
cd "$app_dir"

case "$provider" in
  legacy) ;;
  supabase) [[ "$verified" == true ]] || { echo 'SUPABASE_VERIFIED=true is required for supabase; health is not an SMS test.' >&2; exit 2; } ;;
  *) echo 'AUTH_PHONE_PROVIDER must be legacy or supabase.' >&2; exit 2 ;;
esac
[[ -d "$app_dir" && -f "$env_file" && -f "$compose_file" ]] || { echo 'APP_DIR, .env.production, and docker-compose.yml are required.' >&2; exit 2; }

exec 9>"$app_dir/.deploy.lock"
flock -w 120 9 || { echo 'Timed out waiting for the deployment lock.' >&2; exit 1; }

backup_dir=""
changed=0
rolled_back=0
target_image=""
candidate=""
rollback() {
  rolled_back=1
  local rollback_status=0
  cp -p -- "$backup_dir/env" "$env_file" || rollback_status=1
  if (( rollback_status == 0 )); then
    if ! STEAM_APP_IMAGE="$target_image" docker compose -f "$compose_file" up -d --force-recreate --no-deps --no-build --pull never --wait --wait-timeout "$wait_timeout" steam-app; then rollback_status=1; fi
  fi
  if (( rollback_status == 0 )); then changed=0; return 0; fi
  rolled_back=0
  return 1
}
cleanup() {
  local status=$?
  [[ -z "$candidate" || ! -e "$candidate" ]] || rm -f -- "$candidate"
  if (( status != 0 && changed == 1 && rolled_back == 0 )); then
    rollback || echo "Rollback failed; backup retained at $backup_dir" >&2
  fi
  if [[ -n "$backup_dir" && -d "$backup_dir" && $rolled_back == 1 ]]; then rm -rf -- "$backup_dir"; fi
  return "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

running="$(docker inspect -f '{{.State.Running}}' steam-app 2>/dev/null || true)"
health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' steam-app 2>/dev/null || true)"
running_image="$(docker inspect -f '{{.Image}}' steam-app 2>/dev/null || true)"
[[ "$running" == true && "$health" == healthy && -n "$running_image" ]] || {
  echo 'steam-app must be running and healthy before changing its phone provider.' >&2
  exit 1
}

backup_dir="$(mktemp -d "$app_dir/.auth-phone-provider.XXXXXX")"
cp -p -- "$env_file" "$backup_dir/env"
printf '%s\n' "$running_image" >"$backup_dir/image"
target_image="$running_image"
[[ -n "$target_image" ]] || { echo 'The running image reference is empty.' >&2; exit 1; }

candidate="$(mktemp "$app_dir/.env.production.new.XXXXXX")"
awk -v value="$provider" '$0 !~ /^AUTH_PHONE_PROVIDER[[:space:]]*=/ { print } END { print "AUTH_PHONE_PROVIDER=" value }' "$env_file" >"$candidate"
chmod --reference="$env_file" "$candidate"
mv -f -- "$candidate" "$env_file"
candidate=""
changed=1

STEAM_APP_IMAGE="$target_image" docker compose -f "$compose_file" up -d --force-recreate --no-deps --no-build --pull never --wait --wait-timeout "$wait_timeout" steam-app
actual="$(docker compose -f "$compose_file" exec -T steam-app node -e 'process.stdout.write(process.env.AUTH_PHONE_PROVIDER || "")')"
[[ "$actual" == "$provider" ]] || { echo "Running container has AUTH_PHONE_PROVIDER=$actual, expected $provider." >&2; exit 1; }

changed=0
rm -rf -- "$backup_dir"
backup_dir=""
