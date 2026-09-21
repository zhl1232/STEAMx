import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, writeFile, access, symlink, readlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const script = path.join(process.cwd(), 'deploy', 'registry-deploy.sh')

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
  [[ "\${FAKE_PULL_FAIL-}" != 1 ]]
  exit $?
fi
if [[ "$1" == inspect ]]; then
  [[ -n "\${FAKE_RUNNING_IMAGE_ID-}" ]] && printf '%s\\n' "$FAKE_RUNNING_IMAGE_ID"
  exit 0
fi
if [[ "$1" == tag ]]; then
  printf 'TAG %s\\n' "$*" >> "$FAKE_LOG"
  exit 0
fi
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
