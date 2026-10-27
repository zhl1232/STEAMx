import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, writeFile, access, symlink, readlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const script = path.join(process.cwd(), 'deploy', 'registry-deploy.sh')

const imageId = `sha256:${'c'.repeat(64)}`

const fakeDocker = `#!/usr/bin/env bash
set -u
printf 'CONFIG=%s ARGS=%s\\n' "\${DOCKER_CONFIG-}" "$*" >> "$FAKE_LOG"
if [[ "$1 \${2-} \${3-}" == 'compose up --help' ]]; then
  if [[ "\${FAKE_UNSUPPORTED-}" == 1 ]]; then
    printf 'Usage: docker compose up [OPTIONS]\\n'
  else
    printf 'Usage: docker compose up --wait --wait-timeout\\n'
  fi
  exit 0
fi
if [[ "$1" == login ]]; then
  cat >/dev/null
  exit 0
fi
if [[ "$1" == pull ]]; then
  if [[ "\${FAKE_PULL_TIMEOUT-}" == 1 ]]; then sleep 10; fi
  if [[ -n "\${FAKE_PULL_SLEEP-}" ]]; then sleep "$FAKE_PULL_SLEEP"; fi
  if [[ "\${FAKE_PULL_FIRST_FAIL-}" == 1 && ! -f "$FAKE_COUNT.pull" ]]; then touch "$FAKE_COUNT.pull"; exit 1; fi
  [[ "\${FAKE_PULL_FAIL-}" != 1 ]]
  exit $?
fi
if [[ "$1" == image && "$2" == inspect ]]; then
  if [[ "\${FAKE_IMAGE_PRESENT-}" == 1 ]]; then
    printf '%s\\n' "\${FAKE_INSPECT_IMAGE_ID:-$IMAGE_ID}"
    exit 0
  fi
  exit 1
fi
if [[ "$1" == inspect ]]; then
  [[ -n "\${FAKE_RUNNING_IMAGE_ID-}" ]] && printf '%s\\n' "$FAKE_RUNNING_IMAGE_ID"
  exit 0
fi
if [[ "$1" == load ]]; then
  cat >/dev/null
  [[ "\${FAKE_LOAD_FAIL-}" != 1 ]]
  exit $?
fi
if [[ "$1" == tag ]]; then
  printf 'TAG %s\\n' "$*" >> "$FAKE_LOG"
  exit 0
fi
if [[ "$1" == exec ]]; then
  [[ "\${FAKE_PREFLIGHT_HEALTH_FAIL-}" != 1 ]]
  exit $?
fi
if [[ "$1" == rm ]]; then exit 0; fi
if [[ "$1" == compose ]]; then
  env_file=''
  args="$*"
  while (($#)); do
    if [[ "$1" == --env-file ]]; then env_file="$2"; shift 2; continue; fi
    shift
  done
  if [[ -n "$env_file" ]]; then
    { printf 'ENV_FILE_BEGIN\\n'; cat "$env_file"; printf 'ENV_FILE_END\\n'; } >> "$FAKE_LOG"
  fi
  if [[ -n "\${FAKE_COMPOSE_PATH-}" ]]; then printf 'COMPOSE_CONTENT_BEGIN\\n'; cat "$FAKE_COMPOSE_PATH"; printf 'COMPOSE_CONTENT_END\\n'; fi >> "$FAKE_LOG"
  if [[ "$args" == *' run '* ]]; then
    if [[ "$args" == *'scripts/db-push.mjs push --only='* ]]; then
      [[ "\${FAKE_MIGRATION_FAIL-}" != 1 ]]
      exit $?
    fi
    [[ "\${FAKE_PREFLIGHT_START_FAIL-}" != 1 ]] || exit 1
    printf 'candidate-container\\n'
    exit 0
  fi
  count_file="$FAKE_COUNT"
  count=0
  [[ -f "$count_file" ]] && count=$(<"$count_file")
  count=$((count + 1))
  printf '%s' "$count" >"$count_file"
  if [[ ",\${FAKE_COMPOSE_FAIL_AT-}," == *",$count,"* ]]; then exit 1; fi
  exit 0
fi
exit 99
`

async function setup(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'registry-deploy-test-'))
  const bin = path.join(root, 'bin')
  const app = path.join(root, 'app')
  await import('node:fs/promises').then(({ mkdir }) => mkdir(bin))
  await import('node:fs/promises').then(({ mkdir }) => mkdir(app))
  const docker = path.join(bin, 'docker')
  const nginx = path.join(bin, 'nginx')
  const systemctl = path.join(bin, 'systemctl')
  const sudo = path.join(bin, 'sudo')
  const log = path.join(root, 'docker.log')
  const count = path.join(root, 'compose.count')
  await writeFile(docker, fakeDocker)
  await chmod(docker, 0o755)
  await writeFile(nginx, '#!/usr/bin/env bash\nprintf \'NGINX %s\\n\' "$*" >> "$FAKE_LOG"\n[[ "${FAKE_NGINX_FAIL-}" != 1 ]]\n')
  await chmod(nginx, 0o755)
  await writeFile(systemctl, '#!/usr/bin/env bash\nprintf \'SYSTEMCTL %s\\n\' "$*" >> "$FAKE_LOG"\n[[ "${FAKE_RELOAD_FAIL-}" != 1 ]]\n')
  await chmod(systemctl, 0o755)
  await writeFile(sudo, '#!/usr/bin/env bash\n[[ "$1" == -n ]] && shift\n"$@"\n')
  await chmod(sudo, 0o755)
  const curl = path.join(bin, 'curl')
  await writeFile(curl, `#!/usr/bin/env bash
set -u
printf 'CURL %s\\n' "$*" >> "$FAKE_LOG"
if [[ "\${FAKE_CURL_FAIL-}" == 1 ]]; then exit 22; fi
out=""
while (($#)); do
  if [[ "$1" == --output || "$1" == -o ]]; then out="$2"; shift 2; continue; fi
  shift
done
if [[ -z "$out" ]]; then exit 2; fi
if [[ "\${FAKE_CURL_EMPTY-}" == 1 ]]; then : >"$out"; exit 0; fi
if [[ -n "\${FAKE_CURL_SLEEP-}" ]]; then sleep "$FAKE_CURL_SLEEP"; fi
printf 'fake-image-archive' >"$out"
`)
  await chmod(curl, 0o755)
  const gunzip = path.join(bin, 'gunzip')
  await writeFile(gunzip, `#!/usr/bin/env bash
set -u
if [[ "\${FAKE_GUNZIP_FAIL-}" == 1 ]]; then exit 1; fi
printf 'GUNZIP %s\\n' "$*" >> "$FAKE_LOG"
while (($#)); do
  if [[ "$1" == -c || "$1" == --stdout ]]; then shift; continue; fi
  if [[ "$1" == -- ]]; then shift; continue; fi
  if [[ -f "$1" ]]; then cat "$1"; exit 0; fi
  shift
done
exit 1
`)
  await chmod(gunzip, 0o755)
  await writeFile(path.join(app, 'docker-compose.yml'), 'services: {}\n')
  if (overrides.envFile !== undefined) await writeFile(path.join(app, '.env'), overrides.envFile)
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    APP_DIR: app,
    COMPOSE_FILE: path.join(app, 'docker-compose.yml'),
    FAKE_LOG: log,
    FAKE_COUNT: count,
    FAKE_COMPOSE_PATH: path.join(app, 'docker-compose.yml'),
    IMAGE_DIGEST: 'sha256:new',
    GHCR_USERNAME: 'robot',
    GHCR_TOKEN: 'secret-token',
    REGISTRY_IMAGE: 'ghcr.io/acme/steam',
    COMPOSE_WAIT_TIMEOUT: '17',
    IMAGE_PULL_BACKOFF_SECONDS: '0',
    ...overrides.env,
  }
  return { root, app, log, env, cleanup: () => rm(root, { recursive: true, force: true }) }
}

function run(env) {
  return spawnSync('bash', [script], { cwd: process.cwd(), env, encoding: 'utf8' })
}

async function text(file) {
  try { return await readFile(file, 'utf8') } catch { return '' }
}

async function migrationCandidate(fixture) {
  const dir = path.join(fixture.root, 'migration-bundle')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(path.join(dir, 'scripts'), { recursive: true })
  await mkdir(path.join(dir, 'supabase', 'migrations'), { recursive: true })
  await writeFile(path.join(dir, 'scripts', 'db-push.mjs'), '// mock runner\n')
  await writeFile(path.join(fixture.app, '.env.production'), 'SUPABASE_SERVICE_ROLE_KEY=test-only\n')
  Object.assign(fixture.env, {
    CANDIDATE_MIGRATION_DIR: dir,
    MIGRATION_ALLOWLIST: '20261012160000_tutor_total_usage_billing.sql,20261012170000_ai_credit_grants.sql,20261012171000_tutor_daily_credit_billing.sql',
    PREFLIGHT_ATTEMPTS: '2',
    PREFLIGHT_INTERVAL_SECONDS: '0',
  })
  return dir
}

async function configCandidates(fixture) {
  const composeCandidate = path.join(fixture.root, 'candidate-compose.yml')
  const nginxCandidate = path.join(fixture.root, 'candidate-nginx.conf')
  const nginxPath = path.join(fixture.root, 'sites-available', 'steam-app')
  const enabledPath = path.join(fixture.root, 'sites-enabled', 'steam-app')
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(nginxPath), { recursive: true }))
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(enabledPath), { recursive: true }))
  await writeFile(composeCandidate, 'candidate-compose\n')
  await writeFile(nginxCandidate, 'candidate-nginx\n')
  await writeFile(path.join(fixture.app, 'docker-compose.yml'), 'old-compose\n')
  await writeFile(nginxPath, 'old-nginx\n')
  await import('node:fs/promises').then(({ symlink }) => symlink(nginxPath, enabledPath))
  Object.assign(fixture.env, {
    CANDIDATE_COMPOSE_FILE: composeCandidate,
    CANDIDATE_NGINX_FILE: nginxCandidate,
    NGINX_SITE_PATH: nginxPath,
    NGINX_SITE_ENABLED_PATH: enabledPath,
  })
  return { composeCandidate, nginxCandidate, nginxPath, enabledPath }
}

test('successful deploy persists selected digest and preserves interpolation variables', async (t) => {
  const fixture = await setup({ envFile: 'API_URL=https://example.test\nSTEAM_APP_IMAGE=old\n' })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(await text(path.join(fixture.app, '.env')), 'API_URL=https://example.test\nSTEAM_APP_IMAGE=ghcr.io/acme/steam@sha256:new\n')
  const log = await text(fixture.log)
  assert.match(log, /ARGS=compose --env-file .* up -d --force-recreate --no-build --pull never --wait --wait-timeout 17/)
  assert.match(log, /ENV_FILE_BEGIN[\s\S]*API_URL=https:\/\/example\.test[\s\S]*STEAM_APP_IMAGE=ghcr\.io\/acme\/steam@sha256:new/)
  assert.doesNotMatch(log, /ARGS=pull .*--pull/)
  const config = log.match(/CONFIG=(\S+)/)?.[1]
  assert.ok(config)
  await assert.rejects(access(config, constants.F_OK))
})

test('pull failure does not compose up or mutate .env, and removes temporary credentials', async (t) => {
  const fixture = await setup({ envFile: 'API_URL=https://example.test\nSTEAM_APP_IMAGE=old\n', env: { FAKE_PULL_FAIL: '1' } })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.equal(await text(path.join(fixture.app, '.env')), 'API_URL=https://example.test\nSTEAM_APP_IMAGE=old\n')
  const log = await text(fixture.log)
  assert.match(log, /ARGS=login ghcr\.io/)
  assert.match(log, /ARGS=pull ghcr\.io\/acme\/steam@sha256:new/)
  assert.doesNotMatch(log, /ARGS=compose --env-file/)
  const config = log.match(/CONFIG=(\S+)/)?.[1]
  assert.ok(config)
  await assert.rejects(access(config, constants.F_OK))
})

test('health failure rolls back using exact previous image tag and persists rollback ref', async (t) => {
  const fixture = await setup({ envFile: 'API_URL=https://example.test\nSTEAM_APP_IMAGE=old\n', env: { FAKE_RUNNING_IMAGE_ID: 'sha256:previous', FAKE_COMPOSE_FAIL_AT: '1' } })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.equal(result.status, 1)
  assert.equal(result.stderr, '')
  assert.equal(await text(path.join(fixture.app, '.env')), 'API_URL=https://example.test\nSTEAM_APP_IMAGE=steam-app:rollback\n')
  const log = await text(fixture.log)
  assert.match(log, /TAG tag sha256:previous steam-app:rollback/)
  assert.match(log, /ENV_FILE_BEGIN[\s\S]*STEAM_APP_IMAGE=ghcr\.io\/acme\/steam@sha256:new[\s\S]*ENV_FILE_END[\s\S]*ENV_FILE_BEGIN[\s\S]*STEAM_APP_IMAGE=steam-app:rollback/)
  assert.match(log, /--pull never/)
})

test('rollback failure remains nonzero and leaves original .env unchanged', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\nKEEP=value\n', env: { FAKE_RUNNING_IMAGE_ID: 'sha256:previous', FAKE_COMPOSE_FAIL_AT: '1,2' } })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /rollback health check failed/)
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=old\nKEEP=value\n')
})

test('unsupported compose is rejected before login and mutation', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_UNSUPPORTED: '1' } })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /must support --wait and --wait-timeout/)
  const log = await text(fixture.log)
  assert.match(log, /ARGS=compose up --help/)
  assert.doesNotMatch(log, /ARGS=login|ARGS=pull|ARGS=tag|ARGS=compose --env-file/)
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=old\n')
})

test('candidate pull failure leaves compose and nginx untouched', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_PULL_FAIL: '1' } })
  t.after(fixture.cleanup)
  const paths = await configCandidates(fixture)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.equal(await text(path.join(fixture.app, 'docker-compose.yml')), 'old-compose\n')
  assert.equal(await text(paths.nginxPath), 'old-nginx\n')
  assert.equal(await (await import('node:fs/promises')).readlink(paths.enabledPath), paths.nginxPath)
})

test('invalid nginx restores candidate compose, nginx, and enabled symlink', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_NGINX_FAIL: '1' } })
  t.after(fixture.cleanup)
  const paths = await configCandidates(fixture)
  const result = run(fixture.env)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /nginx configuration validation failed/)
  assert.equal(await text(path.join(fixture.app, 'docker-compose.yml')), 'old-compose\n')
  assert.equal(await text(paths.nginxPath), 'old-nginx\n')
  assert.equal(await (await import('node:fs/promises')).readlink(paths.enabledPath), paths.nginxPath)
  assert.doesNotMatch(await text(fixture.log), /ARGS=compose --env-file/)
})

test('health failure restores config before rolling back the prior image', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_RUNNING_IMAGE_ID: 'sha256:previous', FAKE_COMPOSE_FAIL_AT: '1' } })
  t.after(fixture.cleanup)
  await configCandidates(fixture)
  const result = run(fixture.env)
  assert.equal(result.status, 1)
  assert.equal(await text(path.join(fixture.app, 'docker-compose.yml')), 'old-compose\n')
  const log = await text(fixture.log)
  assert.match(log, /ENV_FILE_BEGIN\nSTEAM_APP_IMAGE=steam-app:rollback/)
  assert.match(log, /COMPOSE_CONTENT_BEGIN\nold-compose\nCOMPOSE_CONTENT_END/)
  assert.match(log, /ARGS=compose --env-file [^\n]+ up -d --remove-orphans --force-recreate[^\n]*\nENV_FILE_BEGIN\nSTEAM_APP_IMAGE=steam-app:rollback\nENV_FILE_END\nCOMPOSE_CONTENT_BEGIN\nold-compose\nCOMPOSE_CONTENT_END/)
})

test('successful candidate deploy reloads nginx and keeps new configs', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n' })
  t.after(fixture.cleanup)
  const paths = await configCandidates(fixture)
  const result = run(fixture.env)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(await text(path.join(fixture.app, 'docker-compose.yml')), 'candidate-compose\n')
  assert.equal(await text(paths.nginxPath), 'candidate-nginx\n')
  assert.match(await text(fixture.log), /NGINX -t[\s\S]*SYSTEMCTL reload nginx/)
})

test('nginx reload failure restores config and rolls back the image', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_RUNNING_IMAGE_ID: 'sha256:previous', FAKE_RELOAD_FAIL: '1' } })
  t.after(fixture.cleanup)
  const paths = await configCandidates(fixture)
  const result = run(fixture.env)
  assert.equal(result.status, 1)
  assert.equal(await text(path.join(fixture.app, 'docker-compose.yml')), 'old-compose\n')
  assert.equal(await text(paths.nginxPath), 'old-nginx\n')
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=steam-app:rollback\n')
  const log = await text(fixture.log)
  assert.match(log, /SYSTEMCTL reload nginx[\s\S]*ARGS=compose --env-file [^\n]+ up -d --remove-orphans --force-recreate[^\n]*\nENV_FILE_BEGIN\nSTEAM_APP_IMAGE=steam-app:rollback\nENV_FILE_END\nCOMPOSE_CONTENT_BEGIN\nold-compose\nCOMPOSE_CONTENT_END/)
})


test('failed deploy restores compose and nginx symlinks without altering their targets', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_RUNNING_IMAGE_ID: 'sha256:previous', FAKE_COMPOSE_FAIL_AT: '1' } })
  t.after(fixture.cleanup)
  const paths = await configCandidates(fixture)
  const composePath = path.join(fixture.app, 'docker-compose.yml')
  for (const file of [composePath, paths.nginxPath]) {
    await writeFile(`${file}.original`, await text(file))
    await rm(file)
    await symlink(`${file}.original`, file)
  }
  const result = run(fixture.env)
  assert.equal(result.status, 1, result.stderr)
  assert.equal(await readlink(composePath), `${composePath}.original`)
  assert.equal(await text(`${composePath}.original`), 'old-compose\n')
  assert.equal(await readlink(paths.nginxPath), `${paths.nginxPath}.original`)
  assert.equal(await text(`${paths.nginxPath}.original`), 'old-nginx\n')
})

test('reload and rollback failure preserves the original version record', async (t) => {
  const original = 'KEEP=value\nSTEAM_APP_IMAGE=old\n'
  const fixture = await setup({ envFile: original, env: { FAKE_RUNNING_IMAGE_ID: 'sha256:previous', FAKE_RELOAD_FAIL: '1', FAKE_COMPOSE_FAIL_AT: '2' } })
  t.after(fixture.cleanup)
  const paths = await configCandidates(fixture)
  const result = run(fixture.env)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /rollback health check failed/)
  assert.equal(await text(path.join(fixture.app, '.env')), original)
  assert.equal(await text(path.join(fixture.app, 'docker-compose.yml')), 'old-compose\n')
  assert.equal(await text(paths.nginxPath), 'old-nginx\n')
})

test('partial config installation failure restores all original files before any app switch', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n' })
  t.after(fixture.cleanup)
  const paths = await configCandidates(fixture)
  await rm(paths.nginxCandidate)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.equal(await text(path.join(fixture.app, 'docker-compose.yml')), 'old-compose\n')
  assert.equal(await text(paths.nginxPath), 'old-nginx\n')
  assert.equal(await readlink(paths.enabledPath), paths.nginxPath)
  assert.doesNotMatch(await text(fixture.log), /ARGS=compose --env-file/)
})

test('first deployment with invalid nginx removes newly installed config entries', async (t) => {
  const fixture = await setup({ env: { FAKE_NGINX_FAIL: '1' } })
  t.after(fixture.cleanup)
  const paths = await configCandidates(fixture)
  const files = [path.join(fixture.app, 'docker-compose.yml'), paths.enabledPath, paths.nginxPath]
  for (const file of files) await rm(file)
  assert.notEqual(run(fixture.env).status, 0)
  for (const file of files) await assert.rejects(access(file))
  assert.doesNotMatch(await text(fixture.log), /ARGS=compose --env-file/)
})


test('failed configuration restore retains backups and removes registry credentials', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_NGINX_FAIL: '1' } })
  t.after(fixture.cleanup)
  await configCandidates(fixture)
  const fakeCp = path.join(fixture.root, 'bin', 'cp')
  await writeFile(fakeCp, `#!/usr/bin/env bash
if [[ "$3" == */compose && "$1" == -a ]]; then exit 1; fi
exec /bin/cp "$@"
`)
  await chmod(fakeCp, 0o755)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  const backup = result.stderr.match(/backups retained at (.+)/)?.[1]
  assert.ok(backup, result.stderr)
  t.after(() => rm(backup, { recursive: true, force: true }))
  assert.equal(await text(path.join(backup, 'compose')), 'old-compose\n')
  const config = (await text(fixture.log)).match(/CONFIG=(\S+)/)?.[1]
  assert.ok(config)
  await assert.rejects(access(config))
})


test('transient pull failure retries before any configuration mutation', async (t) => {
  const fixture = await setup({ env: { FAKE_PULL_FIRST_FAIL: '1' } })
  t.after(fixture.cleanup)
  assert.equal(run(fixture.env).status, 0)
  assert.equal((await text(fixture.log)).match(/ARGS=pull /g).length, 2)
})

test('pull timeout exhausts bounded retries without changing the running configuration', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_PULL_TIMEOUT: '1', IMAGE_PULL_TIMEOUT: '1', IMAGE_PULL_ATTEMPTS: '2' } })
  t.after(fixture.cleanup)
  const paths = await configCandidates(fixture)
  const result = run(fixture.env)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /exit 124/)
  assert.match(result.stderr, /exhausted retries/)
  assert.equal(await text(paths.nginxPath), 'old-nginx\n')
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=old\n')
  assert.doesNotMatch(await text(fixture.log), /ARGS=compose --env-file/)
})

test('a held server deployment lock rejects release before pulling or changing configuration', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { DEPLOY_LOCK_TIMEOUT: '1' } })
  t.after(fixture.cleanup)
  const result = spawnSync('flock', [path.join(fixture.app, '.deploy.lock'), 'bash', script], { env: fixture.env, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Another deployment is active/)
  assert.equal(await text(fixture.log), '')
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=old\n')
})

test('scoped release checks the candidate, migrates, then switches using the same digest', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n' })
  t.after(fixture.cleanup)
  const bundle = await migrationCandidate(fixture)
  const result = run(fixture.env)
  assert.equal(result.status, 0, result.stderr)
  const log = await text(fixture.log)
  const healthAt = log.indexOf('ARGS=exec steam-release-check-')
  const migrateAt = log.indexOf('scripts/db-push.mjs push --only=')
  const switchAt = log.indexOf('ARGS=compose --env-file ')
  assert.ok(healthAt >= 0 && healthAt < migrateAt && migrateAt < switchAt, log)
  const runs = log.split('\n').filter(line => line.includes('ARGS=compose ') && line.includes(' run '))
  assert.equal(runs.length, 2)
  assert.ok(runs.every(line => line.includes('--project-directory ') && line.includes('--no-deps --pull never')))
  const selectedImages = log.match(/STEAM_APP_IMAGE=ghcr.io\/acme\/steam@sha256:new/g)
  assert.equal(selectedImages?.length, 3)
  assert.ok(runs[1].includes(`--volume ${bundle}:/migration:ro`))
  assert.ok(runs[1].includes(fixture.env.MIGRATION_ALLOWLIST))
  assert.doesNotMatch(runs[0], /(?:--publish|--service-ports|\s-p\s)/)
  assert.doesNotMatch(log, /test-only|secret-token/)
  assert.match(log, /ARGS=rm -f steam-release-check-/)
})

test('scoped migration failure restores candidate config and never switches the app', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_MIGRATION_FAIL: '1' } })
  t.after(fixture.cleanup)
  await migrationCandidate(fixture)
  const configs = await configCandidates(fixture)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=old\n')
  assert.equal(await text(path.join(fixture.app, 'docker-compose.yml')), 'old-compose\n')
  assert.equal(await text(configs.nginxPath), 'old-nginx\n')
  assert.doesNotMatch(await text(fixture.log), /ARGS=compose --env-file /)
  assert.doesNotMatch(result.stderr, /Database migration phase completed/)
})

test('candidate startup health failure performs no migration or config switch', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_PREFLIGHT_HEALTH_FAIL: '1' } })
  t.after(fixture.cleanup)
  await migrationCandidate(fixture)
  const configs = await configCandidates(fixture)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Candidate application startup check failed/)
  assert.equal(await text(configs.nginxPath), 'old-nginx\n')
  const log = await text(fixture.log)
  assert.doesNotMatch(log, /scripts\/db-push|ARGS=compose --env-file /)
  assert.match(log, /ARGS=rm -f steam-release-check-/)
})

test('scoped release rejects a missing allowlist before pulling or changing configuration', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n' })
  t.after(fixture.cleanup)
  await migrationCandidate(fixture)
  delete fixture.env.MIGRATION_ALLOWLIST
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /explicit allowlist/)
  assert.doesNotMatch(await text(fixture.log), /ARGS=pull|scripts\/db-push|ARGS=compose --env-file /)
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=old\n')
})

test('invalid candidate nginx prevents scoped database changes', async (t) => {
  const fixture = await setup({ env: { FAKE_NGINX_FAIL: '1' } })
  t.after(fixture.cleanup)
  await migrationCandidate(fixture)
  const configs = await configCandidates(fixture)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.equal(await text(configs.nginxPath), 'old-nginx\n')
  assert.doesNotMatch(await text(fixture.log), /scripts\/db-push/)
})

test('a switch failure after migration restores the image and reports the schema boundary', async (t) => {
  const fixture = await setup({
    envFile: 'STEAM_APP_IMAGE=old\n',
    env: { FAKE_RUNNING_IMAGE_ID: 'sha256:old', FAKE_COMPOSE_FAIL_AT: '1' },
  })
  t.after(fixture.cleanup)
  await migrationCandidate(fixture)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.match(await text(path.join(fixture.app, '.env')), /STEAM_APP_IMAGE=steam-app:rollback/)
  assert.match(result.stderr, /Database migration phase completed/)
  assert.match(result.stderr, /older Tutor callers may reject new requests/)
  assert.equal((await text(fixture.log)).match(/scripts\/db-push.mjs push --only=/g)?.length, 1)
})

test('a slow but progressing pull is not killed by a short per-attempt limit', async (t) => {
  const fixture = await setup({ env: { FAKE_PULL_SLEEP: '3', IMAGE_PULL_TIMEOUT: '20', IMAGE_PULL_HEARTBEAT_SECONDS: '1' } })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.equal(result.status, 0, result.stderr)
  assert.equal((await text(fixture.log)).match(/ARGS=pull /g).length, 1)
  assert.match(result.stdout, /still pulling/)
  assert.match(result.stdout, /Image pull finished/)
})

test('pull failures retry up to the default attempt count, then leave config unchanged', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: { FAKE_PULL_FAIL: '1' } })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.equal(result.status, 1)
  assert.equal((await text(fixture.log)).match(/ARGS=pull /g).length, 4)
  assert.match(result.stderr, /exhausted retries/)
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=old\n')
})


test('OSS load verifies trusted config ID and persists that immutable ID without GHCR', async (t) => {
  const fixture = await setup({
    envFile: 'STEAM_APP_IMAGE=old\n',
    env: {
      IMAGE_OSS_URL: 'https://oss.example/deploy/steamx/sha256-new.tar.gz',
      IMAGE_ID: imageId,
      FAKE_IMAGE_PRESENT: '1',
    },
  })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.equal(result.status, 0, result.stderr + result.stdout)
  const log = await text(fixture.log)
  assert.match(log, /CURL /)
  assert.match(log, /ARGS=load/)
  assert.doesNotMatch(log, /ARGS=login/)
  assert.doesNotMatch(log, /ARGS=pull /)
  assert.match(log, new RegExp(`ENV_FILE_BEGIN[\\s\\S]*STEAM_APP_IMAGE=${imageId}`))
  assert.equal(await text(path.join(fixture.app, '.env')), `STEAM_APP_IMAGE=${imageId}\n`)
  assert.match(log, new RegExp(`ARGS=image inspect --format {{.Id}} ${imageId}`))
})

test('OSS download failure falls back to GHCR pull before any config mutation', async (t) => {
  const fixture = await setup({
    envFile: 'STEAM_APP_IMAGE=old\nKEEP=1\n',
    env: {
      IMAGE_OSS_URL: 'https://oss.example/missing.tar.gz',
      IMAGE_ID: imageId,
      FAKE_CURL_FAIL: '1',
    },
  })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.equal(result.status, 0, result.stderr + result.stdout)
  const log = await text(fixture.log)
  assert.match(result.stderr + result.stdout, /Falling back to GHCR/)
  assert.match(log, /ARGS=login/)
  assert.match(log, /ARGS=pull ghcr\.io\/acme\/steam@sha256:new/)
})

test('OSS and GHCR both failing leave the running configuration untouched', async (t) => {
  const fixture = await setup({
    envFile: 'STEAM_APP_IMAGE=old\n',
    env: {
      IMAGE_OSS_URL: 'https://oss.example/missing.tar.gz',
      IMAGE_ID: imageId,
      FAKE_CURL_FAIL: '1',
      FAKE_PULL_FAIL: '1',
      IMAGE_PULL_ATTEMPTS: '2',
    },
  })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Image acquisition exhausted retries/)
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=old\n')
  assert.doesNotMatch(await text(fixture.log), /ARGS=compose --env-file .* up -d/)
})


for (const [name, overrides] of [
  ['missing trusted config ID', { IMAGE_ID: '' }],
  ['malformed trusted config ID', { IMAGE_ID: 'sha256:bad' }],
  ['absent loaded config ID', {}],
  ['mismatched loaded config ID', { FAKE_IMAGE_PRESENT: '1', FAKE_INSPECT_IMAGE_ID: `sha256:${'d'.repeat(64)}` }],
  ['failed docker load', { FAKE_LOAD_FAIL: '1', FAKE_IMAGE_PRESENT: '1' }],
  ['failed gunzip even when docker load succeeds', { FAKE_GUNZIP_FAIL: '1', FAKE_IMAGE_PRESENT: '1' }],
]) {
  test(`OSS ${name} falls back and persists the GHCR digest`, async (t) => {
    const fixture = await setup({ env: {
      IMAGE_OSS_URL: 'https://oss.example/image.tar.gz', IMAGE_ID: imageId, ...overrides,
    } })
    t.after(fixture.cleanup)
    const result = run(fixture.env)
    assert.equal(result.status, 0, result.stderr + result.stdout)
    const log = await text(fixture.log)
    assert.match(log, /ARGS=pull ghcr\.io\/acme\/steam@sha256:new/)
    assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=ghcr.io/acme/steam@sha256:new\n')
  })
}

test('OSS timeout leaves the full independent GHCR pull budget available', async (t) => {
  const fixture = await setup({ env: {
    IMAGE_OSS_URL: 'https://oss.example/slow.tar.gz', IMAGE_ID: imageId,
    IMAGE_OSS_TIMEOUT: '1', FAKE_CURL_SLEEP: '3',
    IMAGE_PULL_TIMEOUT: '4', FAKE_PULL_SLEEP: '2',
  } })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, /remaining budget 4s of 4s/)
  assert.match(await text(fixture.log), /ARGS=pull /)
})


test('wrong loaded ID with failed GHCR fallback never switches configuration', async (t) => {
  const fixture = await setup({ envFile: 'STEAM_APP_IMAGE=old\n', env: {
    IMAGE_OSS_URL: 'https://oss.example/wrong.tar.gz', IMAGE_ID: imageId,
    FAKE_IMAGE_PRESENT: '1', FAKE_INSPECT_IMAGE_ID: `sha256:${'d'.repeat(64)}`,
    FAKE_PULL_FAIL: '1', IMAGE_PULL_ATTEMPTS: '1',
  } })
  t.after(fixture.cleanup)
  const result = run(fixture.env)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /missing or mismatched/)
  assert.equal(await text(path.join(fixture.app, '.env')), 'STEAM_APP_IMAGE=old\n')
  assert.doesNotMatch(await text(fixture.log), /ARGS=compose --env-file /)
})
