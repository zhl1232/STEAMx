import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const script = path.join(process.cwd(), 'deploy', 'auth-phone-provider.sh')
const fakeDocker = `#!/usr/bin/env bash
set -u
printf 'STEAM_APP_IMAGE=%s %s\n' "\${STEAM_APP_IMAGE-}" "$*" >> "$FAKE_LOG"
if [[ "$1" == inspect ]]; then
  case "$3" in
    *Running*) printf '%s\n' "\${FAKE_RUNNING:-true}" ;;
    *Health*) printf '%s\n' "\${FAKE_HEALTH:-healthy}" ;;
    *Image*) printf '%s\n' "\${FAKE_IMAGE:-sha256:old}" ;;
  esac
  exit 0
fi
if [[ "$1" == compose ]]; then
  [[ "$*" != *exec* ]] && { [[ "\${FAKE_COMPOSE_FAIL:-0}" != 1 ]] || exit 1; }
  [[ "$*" == *exec* ]] && printf '%s' "\${FAKE_PROVIDER:-\${AUTH_PHONE_PROVIDER:-legacy}}"
  exit 0
fi
exit 99
`

async function fixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'auth-phone-provider-'))
  const bin = path.join(root, 'bin')
  const app = path.join(root, 'app')
  await import('node:fs/promises').then(({ mkdir }) => Promise.all([mkdir(bin), mkdir(app)]))
  const docker = path.join(bin, 'docker')
  await writeFile(docker, fakeDocker)
  await chmod(docker, 0o755)
  await writeFile(path.join(app, 'docker-compose.yml'), 'services: {}\n')
  await writeFile(path.join(app, '.env.production'), overrides.env ?? 'KEEP=yes\nAUTH_PHONE_PROVIDER=legacy\nAUTH_PHONE_PROVIDER=legacy\n')
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, APP_DIR: app, FAKE_LOG: path.join(root, 'docker.log'), ...overrides.envVars }
  return { root, app, env, cleanup: () => rm(root, { recursive: true, force: true }) }
}
function run(env) { return spawnSync('bash', [script], { env, encoding: 'utf8' }) }
async function text(file) { return readFile(file, 'utf8') }

test('updates one provider assignment atomically and recreates with the exact running image', async t => {
  const f = await fixture(); t.after(f.cleanup)
  const result = run({ ...f.env, AUTH_PHONE_PROVIDER: 'supabase', SUPABASE_VERIFIED: 'true' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(await text(path.join(f.app, '.env.production')), 'KEEP=yes\nAUTH_PHONE_PROVIDER=supabase\n')
  assert.match(await text(f.env.FAKE_LOG), /STEAM_APP_IMAGE=sha256:old compose -f .* up -d --force-recreate --no-deps --no-build --pull never --wait --wait-timeout 120 steam-app/)
})

test('rejects invalid and unverified inputs before docker or file mutation', async t => {
  for (const vars of [{ AUTH_PHONE_PROVIDER: 'wat' }, { AUTH_PHONE_PROVIDER: 'supabase', SUPABASE_VERIFIED: 'false' }]) {
    const f = await fixture(); t.after(f.cleanup)
    const original = await text(path.join(f.app, '.env.production'))
    const result = run({ ...f.env, ...vars })
    assert.equal(result.status, 2)
    assert.equal(await text(path.join(f.app, '.env.production')), original)
    assert.equal(await text(f.env.FAKE_LOG).catch(() => ''), '')
  }
})

test('restores environment and prior image on recreate failure', async t => {
  const f = await fixture({ envVars: { FAKE_COMPOSE_FAIL: '1' } }); t.after(f.cleanup)
  const original = await text(path.join(f.app, '.env.production'))
  const result = run({ ...f.env, AUTH_PHONE_PROVIDER: 'legacy' })
  assert.equal(result.status, 1)
  assert.equal(await text(path.join(f.app, '.env.production')), original)
  assert.match(await text(f.env.FAKE_LOG), /STEAM_APP_IMAGE=sha256:old/)
})

test('refuses a missing healthy running app', async t => {
  const f = await fixture({ envVars: { FAKE_HEALTH: 'starting' } }); t.after(f.cleanup)
  const result = run({ ...f.env, AUTH_PHONE_PROVIDER: 'legacy' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /running and healthy/)
})


test('rollback targets only steam-app and retains .env interpolation', async t => {
  const f = await fixture({ envVars: { FAKE_PROVIDER: 'wrong', STEAM_APP_IMAGE: 'unrelated:tag' } }); t.after(f.cleanup)
  const original = await text(path.join(f.app, '.env.production'))
  const result = run({ ...f.env, AUTH_PHONE_PROVIDER: 'supabase', SUPABASE_VERIFIED: 'true' })
  assert.equal(result.status, 1)
  assert.equal(await text(path.join(f.app, '.env.production')), original)
  const calls = (await text(f.env.FAKE_LOG)).split('\n').filter(l => l.includes(' up -d '))
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.match(call, /^STEAM_APP_IMAGE=sha256:old /)
    assert.match(call, /--no-deps .* steam-app$/)
    assert.doesNotMatch(call, /--env-file/)
  }
})
