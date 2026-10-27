import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { classifyVoiceChanges, detectVoiceScope, HOME_PATHS } from './release-voice-scope.mjs';
import { DOC_PATHS } from './ci-scope.mjs';
import { verifiedStoreMigrations } from './ci-test-impact.mjs';

const before = 'a'.repeat(40), after = 'b'.repeat(40);
const env = { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', RELEASE_BEFORE: before,
  GITHUB_SHA: after, GITHUB_TOKEN: 'fake-local-test-token', GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '2' };
const change = (path, oldMode = '100644', newMode = '100644') => ({ path, oldMode, newMode });
const raw = (paths) => paths.map(p => `:100644 100644 abc def M\0${p}\0`).join('');
const previous = { id: 1, head_sha: before, path: '.github/workflows/release.yml', event: 'push',
  head_branch: 'main', status: 'completed', conclusion: 'success' };
const successfulJobs = ['ci / test-and-lint', 'build-image', 'deploy-production', 'verify-course-voice-loading'].map(name => ({ name, status: 'completed', conclusion: 'success' }));
const response = (runs = [{ id: 2 }, previous], jobs = successfulJobs) => async (url, options) => {
  if (url.includes('/jobs?')) {
    assert.equal(url, 'https://api.github.com/repos/owner/repo/actions/runs/1/jobs?filter=latest&per_page=100');
    return { ok: true, json: async () => ({ jobs, total_count: jobs.length }) };
  }
  assert.equal(url, 'https://api.github.com/repos/owner/repo/actions/workflows/release.yml/runs?per_page=10');
  assert.equal(options.redirect, 'error');
  return { ok: true, json: async () => ({ workflow_runs: runs }) };
};
const git = (paths = [...HOME_PATHS]) => args => {
  if (args[0] === 'rev-parse') return after;
  if (args[0] === 'show') return readFileSync(args[1].split(':')[1], 'utf8');
  if (args[0] === 'fetch') { assert.deepEqual(args, ['fetch', '--no-tags', '--depth=1', 'origin', before]); return ''; }
  assert.deepEqual(args, ['diff', '--raw', '--no-renames', '--no-ext-diff', '-z', before, after, '--']);
  return raw(paths);
};

test('payment and SQL changes do not launch the unrelated voice fixture', async () => {
  const migration = 'supabase/migrations/20261027003000_store_payment_crypto_schema.sql';
  const changes = [change('lib/store/payments/alipay.ts'),
    change('lib/store/payments/alipay.test.ts'),
    change('scripts/test-store-native.mjs', '100755', '100755'),
    change(migration, '000000', '100644'),
    change('docs/STORE_CHANNEL_FULFILLMENT_DECISION.md')];
  const content = readFileSync(migration, 'utf8');
  assert.equal(classifyVoiceChanges(changes, verifiedStoreMigrations(changes, () => content)).mode, 'headers');
  assert.equal(classifyVoiceChanges(changes, verifiedStoreMigrations(changes, () => content + '\nDROP TABLE public.profiles;')).mode, 'headers');
  const paymentGit = args => args[0] === 'diff'
    ? changes.map(c => `:${c.oldMode} ${c.newMode} abc def M\0${c.path}\0`).join('')
    : git([])(args);
  assert.equal((await detectVoiceScope(env, paymentGit, response())).mode, 'headers');
  assert.equal((await detectVoiceScope(env, paymentGit, response([], []))).mode, 'headers');
});

test('only explicit homepage consumers/prose permit header checks on a successful main baseline', async () => {
  for (const path of [...HOME_PATHS, ...DOC_PATHS]) {
    assert.equal(classifyVoiceChanges([change(path)]).mode, 'headers', path);
    assert.equal((await detectVoiceScope(env, git([path]), response())).mode, 'headers', path);
  }
  assert.equal((await detectVoiceScope(env, git([...HOME_PATHS, ...DOC_PATHS]), response())).mode, 'headers');
});
test('shared, auth, data, renderer, voice, config, test and unknown paths force full even mixed with home', async () => {
  for (const path of ['app/page.tsx', 'app/layout.tsx', 'app/globals.css', 'components/ui/button.tsx',
    'lib/utils.ts', 'lib/auth.ts', 'lib/ai/tutor/usage.ts',
    'components/features/courses/building-voice-controls.tsx', 'lib/utils/ldraw-mpd.ts',
    'public/courses/ldraw/3-hu-die.mpd', 'public/courses/vosk/v2/assets.js',
    'public/courses/vosk/v2/resource-cache.js', 'public/courses/vosk/v2/prepare-worker.js',
    'public/sw.js', 'next.config.mjs', 'proxy.ts', 'package.json', 'pnpm-lock.yaml',
    'deploy/nginx.conf', 'Dockerfile', '.github/workflows/release.yml', 'scripts/check-building-voice-loading.mjs',
    'supabase/migrations/example.sql', 'components/home/home-showcase.test.tsx', 'docs/unknown.md', 'new-ui.tsx']) {
    assert.equal((await detectVoiceScope(env, git([...HOME_PATHS, path]), response())).mode, 'full', path);
  }
});
test('reviewed support and footer changes use headers after a successful deployed baseline', async () => {
  const paths = ['lib/support/feishu/config.ts', 'lib/support/feishu/config.test.ts',
    'components/layout/site-footer.tsx', 'components/layout/user-button.tsx',
    'docs/customer-support.md', 'docs/design-system.md'];
  const result = await detectVoiceScope(env, git(paths), response());
  assert.equal(result.mode, 'headers');
  assert.equal(result.before, before);
  assert.equal(result.verifiedSha, after);
  assert.equal(result.ciProfile, 'full', 'core checks stay enabled; specialties have a separate plan');
  assert.equal((await detectVoiceScope(env, git(paths), response([{ ...previous, conclusion: 'failure' }]))).mode, 'headers');
  assert.equal(classifyVoiceChanges([change('lib/store/payments.ts')]).mode, 'headers');
});
test('new/deleted/renamed home components, symlinks and executable changes force full', () => {
  for (const path of HOME_PATHS) {
    for (const [old, next] of [['000000', '100644'], ['100644', '000000'], ['100644', '120000'], ['100755', '100644']]) {
      assert.equal(classifyVoiceChanges([change(path, old, next)]).mode, 'full');
    }
  }
  assert.equal(classifyVoiceChanges([]).mode, 'full');
});
test('manual, tag, first push, missing range, wrong ref and unknown events force full without network', async () => {
  for (const overrides of [{ GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/tags/v1' },
    { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_EVENT_NAME: 'merge_group' }, { GITHUB_REF: 'refs/heads/other' },
    { RELEASE_BEFORE: '0'.repeat(40) }, { RELEASE_BEFORE: '' }, { GITHUB_SHA: '' }, { RELEASE_BEFORE: after }]) {
    assert.equal((await detectVoiceScope({ ...env, ...overrides }, () => { throw Error('unused'); }, () => { throw Error('unused'); })).mode, 'full');
  }
});
test('comparison failures, checkout mismatch and malformed or empty diffs force full', async () => {
  for (const fn of [() => { throw Error('missing object'); }, () => 'wrong',
    args => args[0] === 'diff' ? '' : git()(args), args => args[0] === 'diff' ? 'bad\0' : git()(args)]) {
    assert.equal((await detectVoiceScope(env, fn, response())).mode, 'full');
  }
});
test('missing deployment proof does not launch unchanged voice and grants no CI scope proof', async () => {
  for (const overrides of [{ conclusion: 'failure' }, { status: 'in_progress' }, { head_sha: after },
    { event: 'workflow_dispatch' }, { event: 'pull_request' }, { head_branch: 'v1' }, { path: '.github/workflows/ci.yml' }]) {
    assert.equal((await detectVoiceScope(env, git(), response([{ ...previous, ...overrides }, previous]))).mode, 'headers');
  }
  const missing = await detectVoiceScope(env, git(), response([]));
  assert.equal(missing.mode, 'headers');
  assert.equal(missing.verifiedSha, undefined);
  assert.equal(missing.ciProfile, undefined);
  for (const request of [async () => { throw Error('network'); }, async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({}) })]) {
    assert.equal((await detectVoiceScope(env, git(), request)).mode, 'headers');
  }
  for (const key of ['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID']) {
    assert.equal((await detectVoiceScope({ ...env, [key]: '' }, git(), response())).mode, 'headers');
  }
});

test('unverified deployments retain header checks without claiming a deployed baseline', async () => {
  for (const name of successfulJobs.map(j => j.name)) {
    for (const conclusion of ['skipped', 'failure', 'cancelled']) {
      const jobs = successfulJobs.map(j => j.name === name ? { ...j, conclusion } : j);
      assert.equal((await detectVoiceScope(env, git(), response(undefined, jobs))).mode, 'headers');
    }
    assert.equal((await detectVoiceScope(env, git(), response(undefined, successfulJobs.filter(j => j.name !== name)))).mode, 'headers');
  }
  assert.equal((await detectVoiceScope(env, git(), response(undefined, []))).mode, 'headers');
  const successful = await detectVoiceScope(env, git(), response());
  assert.equal(successful.ciProfile, 'home-ui');
  assert.equal(successful.before, before);
  assert.equal(successful.verifiedSha, after);
});
