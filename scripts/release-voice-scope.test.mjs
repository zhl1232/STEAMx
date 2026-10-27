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
  assert.equal(classifyVoiceChanges(changes, verifiedStoreMigrations(changes, () => content)).mode, 'skip');
  assert.equal(classifyVoiceChanges(changes, verifiedStoreMigrations(changes, () => content + '\nDROP TABLE public.profiles;')).mode, 'skip');
  const paymentGit = args => args[0] === 'diff'
    ? changes.map(c => `:${c.oldMode} ${c.newMode} abc def M\0${c.path}\0`).join('')
    : git([])(args);
  assert.equal((await detectVoiceScope(env, paymentGit, response())).mode, 'skip');
  assert.equal((await detectVoiceScope(env, paymentGit, response([], []))).mode, 'full');
});

test('only explicit homepage consumers/prose skip voice checks on a successful main baseline', async () => {
  for (const path of [...HOME_PATHS, ...DOC_PATHS]) {
    assert.equal(classifyVoiceChanges([change(path)]).mode, 'skip', path);
    assert.equal((await detectVoiceScope(env, git([path]), response())).mode, 'skip', path);
  }
  assert.equal((await detectVoiceScope(env, git([...HOME_PATHS, ...DOC_PATHS]), response())).mode, 'skip');
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
test('reviewed support and footer changes skip voice checks after a successful deployed baseline', async () => {
  const paths = ['lib/support/feishu/config.ts', 'lib/support/feishu/config.test.ts',
    'components/layout/site-footer.tsx', 'components/layout/user-button.tsx',
    'docs/customer-support.md', 'docs/design-system.md'];
  const result = await detectVoiceScope(env, git(paths), response());
  assert.equal(result.mode, 'skip');
  assert.equal(result.before, before);
  assert.equal(result.verifiedSha, after);
  assert.equal(result.ciProfile, 'full', 'core checks stay enabled; specialties have a separate plan');
  assert.equal((await detectVoiceScope(env, git(paths), response([{ ...previous, conclusion: 'failure' }]))).mode, 'full');
  assert.equal(classifyVoiceChanges([change('lib/store/payments.ts')]).mode, 'skip');
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
test('missing deployment proof requires full voice validation and grants no CI scope proof', async () => {
  for (const overrides of [{ conclusion: 'failure' }, { status: 'in_progress' }, { head_sha: after },
    { event: 'workflow_dispatch' }, { event: 'pull_request' }, { head_branch: 'v1' }, { path: '.github/workflows/ci.yml' }]) {
    assert.equal((await detectVoiceScope(env, git(), response([{ ...previous, ...overrides }, previous]))).mode, 'full');
  }
  const missing = await detectVoiceScope(env, git(), response([]));
  assert.equal(missing.mode, 'full');
  assert.equal(missing.verifiedSha, undefined);
  assert.equal(missing.ciProfile, undefined);
  for (const request of [async () => { throw Error('network'); }, async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({}) })]) {
    assert.equal((await detectVoiceScope(env, git(), request)).mode, 'full');
  }
  for (const key of ['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID']) {
    assert.equal((await detectVoiceScope({ ...env, [key]: '' }, git(), response())).mode, 'full');
  }
});

test('unverified deployments require full voice validation without claiming a deployed baseline', async () => {
  for (const name of successfulJobs.map(j => j.name)) {
    for (const conclusion of ['skipped', 'failure', 'cancelled']) {
      const jobs = successfulJobs.map(j => j.name === name ? { ...j, conclusion } : j);
      assert.equal((await detectVoiceScope(env, git(), response(undefined, jobs))).mode, 'full');
    }
    assert.equal((await detectVoiceScope(env, git(), response(undefined, successfulJobs.filter(j => j.name !== name)))).mode, 'full');
  }
  assert.equal((await detectVoiceScope(env, git(), response(undefined, []))).mode, 'full');
  const successful = await detectVoiceScope(env, git(), response());
  assert.equal(successful.ciProfile, 'home-ui');
  assert.equal(successful.before, before);
  assert.equal(successful.verifiedSha, after);
});

test('a store-only push fully validates voice changes left unverified by the previous release', async () => {
  // A introduced voice changes; B changes only payments. A..B omits the voice
  // changes even though B's image includes them, so A must be a proven deployment.
  const storeGit = git(['lib/store/payments/alipay.ts']);
  const scenarios = [
    ['failed release', response([{ ...previous, conclusion: 'failure' }])],
    ['skipped deployment', response(undefined, successfulJobs.map(job => job.name === 'deploy-production'
      ? { ...job, conclusion: 'skipped' } : job))],
    ['failed voice validation', response(undefined, successfulJobs.map(job => job.name === 'verify-course-voice-loading'
      ? { ...job, conclusion: 'failure' } : job))],
    ['unavailable history API', async () => ({ ok: false })],
    ['unavailable jobs API', async (url, options) => url.includes('/jobs?')
      ? { ok: false } : response()(url, options)],
  ];
  for (const [scenario, request] of scenarios) {
    const result = await detectVoiceScope(env, storeGit, request);
    assert.equal(result.mode, 'full', scenario);
    assert.equal(result.verifiedSha, undefined, scenario);
    assert.equal(result.ciProfile, undefined, scenario);
  }
  const verified = await detectVoiceScope(env, storeGit, response());
  assert.equal(verified.mode, 'skip');
  assert.equal(verified.verifiedSha, after);
});

test('consecutive unchanged releases preserve an intentional skip without requesting voice resources', async () => {
  const jobs = [...successfulJobs.map(job => job.name === 'verify-course-voice-loading'
    ? { ...job, conclusion: 'skipped' } : job),
  { name: 'release-scope', status: 'completed', conclusion: 'success' }];
  for (let release = 0; release < 3; release++) {
    const base = String(release + 1).repeat(40), next = String(release + 2).repeat(40);
    const localGit = args => {
      if (args[0] === 'rev-parse') return next;
      if (args[0] === 'fetch') {
        assert.deepEqual(args, ['fetch', '--no-tags', '--depth=1', 'origin', base]);
        return '';
      }
      if (args[0] === 'show') return readFileSync(args[1].split(':')[1], 'utf8');
      assert.deepEqual(args, ['diff', '--raw', '--no-renames', '--no-ext-diff', '-z', base, next, '--']);
      return raw(['lib/support/server.ts']);
    };
    const request = response([{ id: 2 }, { ...previous, head_sha: base }], jobs);
    const result = await detectVoiceScope({ ...env, RELEASE_BEFORE: base, GITHUB_SHA: next }, localGit, request);
    assert.equal(result.mode, 'skip');
    assert.equal(result.before, base);
    assert.equal(result.verifiedSha, next);
  }
});

test('an intentionally skipped baseline still fully validates new voice changes', async () => {
  const result = await detectVoiceScope(env, git(['public/courses/vosk/v2/assets.js']),
    () => { throw Error('Unneeded history request'); });
  assert.equal(result.mode, 'full');
  assert.equal(result.verifiedSha, undefined);
});

test('skipped legacy, changed or incomplete policies cannot establish a voice baseline', async () => {
  const jobs = [...successfulJobs.map(job => job.name === 'verify-course-voice-loading'
    ? { ...job, conclusion: 'skipped' } : job),
  { name: 'release-scope', status: 'completed', conclusion: 'success' }];
  const guard = "    if: needs.release-scope.outputs.voice-mode != 'skip'\n";
  for (const scenario of ['legacy workflow', 'changed workflow', 'changed scope policy', 'unreadable policy']) {
    const localGit = args => {
      if (args[0] !== 'show') return git(['lib/support/server.ts'])(args);
      const [revision, path] = args[1].split(':');
      const content = readFileSync(path, 'utf8');
      if (scenario === 'unreadable policy') throw Error('Missing historical file');
      if (scenario === 'legacy workflow' && path.endsWith('.yml')) return content.replace(guard, '');
      if (revision === before && (scenario === 'changed workflow' && path.endsWith('.yml')
        || scenario === 'changed scope policy' && path.endsWith('.mjs'))) return content + '\n// different policy';
      return content;
    };
    assert.equal((await detectVoiceScope(env, localGit, response(undefined, jobs))).mode, 'full', scenario);
  }
  for (const conclusion of ['failure', 'cancelled', 'skipped']) {
    const unproven = jobs.map(job => job.name === 'release-scope' ? { ...job, conclusion } : job);
    assert.equal((await detectVoiceScope(env, git(['lib/support/server.ts']), response(undefined, unproven))).mode, 'full');
  }
  const missingScope = jobs.filter(job => job.name !== 'release-scope');
  assert.equal((await detectVoiceScope(env, git(['lib/support/server.ts']), response(undefined, missingScope))).mode, 'full');
});
