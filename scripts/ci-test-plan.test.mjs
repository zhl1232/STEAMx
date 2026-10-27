import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planCITests, planCIChecks } from './ci-test-plan.mjs';

const before = 'a'.repeat(40), head = 'b'.repeat(40), after = 'c'.repeat(40);
const env = { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: after,
  GITHUB_TOKEN: 'local-test-secret', GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '20' };
const push = { before, after };
const prEnv = { ...env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/pull/1/merge' };
const pr = { action: 'synchronize', pull_request: { draft: false, base: { sha: before }, head: { sha: head } } };
const support = [
  'components/layout/conditional-app-shell.test.tsx', 'components/layout/site-footer.test.tsx',
  'components/layout/site-footer.tsx', 'components/layout/user-button.test.tsx',
  'components/layout/user-button.tsx', 'docs/STORE_CHANNEL_FULFILLMENT_DECISION.md',
  'docs/customer-support.md', 'docs/design-system.md', 'docs/seo-indexing-checklist.md',
  'lib/support/feishu/config.test.ts', 'lib/support/feishu/config.ts',
];
const raw = paths => paths.map(path => `:100644 100644 abc def M\0${path}\0`).join('');
const git = (paths = support, calls = []) => args => {
  calls.push(args);
  if (args[0] === 'rev-parse') return after;
  if (args[0] === 'show' && args[1] === '-s') return `${before} ${head}`;
  if (args[0] === 'show') return readFileSync(args[1].slice(41), 'utf8');
  if (args[0] === 'fetch') {
    assert.deepEqual(args, ['fetch', '--no-tags', '--depth=1', 'origin', before]); return '';
  }
  if (args[0] === 'merge-base') {
    assert.deepEqual(args, ['merge-base', '--is-ancestor', before, after]); return '';
  }
  assert.deepEqual(args, ['diff', '--raw', '--no-renames', '--no-ext-diff', '-z', before, after, '--']);
  return raw(paths);
};
const previous = { id: 10, head_sha: before, path: '.github/workflows/release.yml',
  event: 'push', head_branch: 'main', status: 'completed', conclusion: 'success' };
const ci = { name: 'ci / test-and-lint', status: 'completed', conclusion: 'success' };
const history = (runs = [previous]) => ({ workflow_runs: runs, total_count: runs.length });
const jobs = (items = [ci]) => ({ jobs: items, total_count: items.length });
const request = (runs = history(), jobData = jobs(), calls = []) => async (url, options) => {
  calls.push(url);
  assert.equal(options.headers.Authorization, `Bearer ${env.GITHUB_TOKEN}`);
  assert.equal(options.redirect, 'error');
  assert.ok(options.signal instanceof AbortSignal);
  if (url.includes('/jobs?')) {
    assert.match(url, /^https:\/\/api\.github\.com\/repos\/owner\/repo\/actions\/runs\/\d+\/jobs\?filter=latest&per_page=100$/);
    return { ok: true, json: async () => jobData };
  }
  assert.equal(url, `https://api.github.com/repos/owner/repo/actions/runs?head_sha=${before}&event=push&per_page=10`);
  return { ok: true, json: async () => runs };
};
const noRequest = () => { throw Error('Unexpected local API call'); };
const noGit = () => { throw Error('Unexpected git call'); };
const flags = result => {
  const { reason, ...selection } = result;
  assert.ok(reason.length > 0); return selection;
};
const all = { physics: true, projectVideo: true, building: true, voice: true };
const none = { physics: false, projectVideo: false, building: false, voice: false };

test('exact eleven-file support change has no specialty only with reliable prior main CI', async () => {
  const calls = [], api = [];
  const result = await planCITests(env, push, git(support, calls), request(undefined, undefined, api));
  assert.deepEqual(flags(result), none);
  assert.equal(support.length, 11);
  assert.equal(api.length, 2);
  assert.equal(calls.filter(args => args[0] === 'diff').length, 1);
  assert.ok(calls.some(args => args[0] === 'merge-base'));
});

test('validated isolated PRs and main with an exact CI baseline select related units', async () => {
  const paths = ['components/support/support-chat.tsx', 'lib/support/server.test.ts'];
  const selected = await planCIChecks(prEnv, pr, git(paths), noRequest);
  assert.equal(selected.unitMode, 'related');
  assert.deepEqual(selected.unitSources, paths);
  assert.equal(selected.smokeHome, false);
  assert.equal(selected.guides, false);
  const main = await planCIChecks(env, push, git(paths), request());
  assert.equal(main.unitMode, 'related');
  assert.deepEqual(main.unitSources, paths);
  assert.equal(main.smokePlayground, false);
  const missingBaseline = await planCIChecks(env, push, git(paths), request(history([])));
  assert.equal(missingBaseline.unitMode, 'full');
  assert.equal(missingBaseline.smokeHome, true);
  assert.equal(missingBaseline.guides, true);
});

test('prior successful CI remains a source baseline when later deployment fails or cancels', async () => {
  for (const conclusion of ['failure', 'cancelled']) {
    assert.deepEqual(flags(await planCITests(env, push, git(),
      request(history([{ ...previous, conclusion }]), jobs([ci,
        { name: 'deploy-production', status: 'completed', conclusion }])))), none);
  }
});

test('latest exact-before release and latest CI attempt must pass, never an older green', async () => {
  for (const conclusion of ['failure', 'cancelled', 'skipped', null]) {
    assert.deepEqual(flags(await planCITests(env, push, git(), request(undefined,
      jobs([{ ...ci, conclusion }])))), none);
  }
  for (const jobData of [jobs([]), jobs([{ ...ci, status: 'in_progress' }]),
    jobs([{ ...ci, name: 'other / test-and-lint' }]), jobs([ci, ci]),
    { ...jobs(), total_count: 101 }, {}, { jobs: [null], total_count: 1 }]) {
    assert.deepEqual(flags(await planCITests(env, push, git(), request(undefined, jobData))), none);
  }
  const seen = [];
  assert.deepEqual(flags(await planCITests(env, push, git(), request(history([
    previous, { ...previous, id: 15 }, { ...previous, id: 20 },
  ]), jobs([{ ...ci, conclusion: 'failure' }]), seen))), none);
  assert.ok(seen[1].includes('/15/jobs?'));
});

test('missing/stale/wrong run identity, paginated or malformed history falls back', async () => {
  for (const runs of [history([]), {}, { ...history(), total_count: 11 },
    history([null]), history([{ ...previous, id: '10' }]),
    history([{ ...previous, id: 15, head_sha: head }, previous]),
    ...[{ head_sha: head }, { path: '.github/workflows/ci.yml' }, { event: 'pull_request' },
      { head_branch: 'feature' }, { id: 20 }, { id: 21 }].map(patch => history([{ ...previous, ...patch }]))]) {
    assert.deepEqual(flags(await planCITests(env, push, git(), request(runs))), none);
  }
});

test('unauthenticated or invalid repository/run context never requests a baseline', async () => {
  for (const patch of [{ GITHUB_TOKEN: '' }, { GITHUB_TOKEN: ' ' }, { GITHUB_REPOSITORY: '' },
    { GITHUB_REPOSITORY: 'owner/../repo' }, { GITHUB_REPOSITORY: 'owner/..' },
    { GITHUB_REPOSITORY: 'owner/repo?token=secret' }, { GITHUB_RUN_ID: '' },
    { GITHUB_RUN_ID: 'other' }, { GITHUB_RUN_ID: '-2' }]) {
    assert.deepEqual(flags(await planCITests({ ...env, ...patch }, push, git(), noRequest)), none);
  }
});

test('API errors, timeout, invalid JSON and redirects cannot leak secrets or narrow', async () => {
  for (const api of [async () => { throw Error(env.GITHUB_TOKEN); },
    async () => ({ ok: false, json: async () => ({ token: env.GITHUB_TOKEN }) }),
    async () => ({ ok: true, json: async () => { throw Error(env.GITHUB_TOKEN); } }),
    async () => { throw new DOMException(env.GITHUB_TOKEN, 'TimeoutError'); }]) {
    const result = await planCITests(env, push, git(), api);
    assert.deepEqual(flags(result), none);
    assert.ok(!JSON.stringify(result).includes(env.GITHUB_TOKEN));
  }
});

test('validated PR merge selects directly with no credentials, fetch or API', async () => {
  const calls = [];
  for (const action of ['opened', 'synchronize', 'reopened', 'ready_for_review']) {
    assert.deepEqual(flags(await planCITests({ ...prEnv, GITHUB_TOKEN: '' }, { ...pr, action },
      git(support, calls), noRequest)), none);
  }
  assert.ok(calls.every(args => !['fetch', 'merge-base'].includes(args[0])));
  for (const parent of [`${head} ${before}`, before, `${before} ${head} ${after}`]) {
    const wrongParents = args => args[0] === 'show' ? parent : git()(args);
    assert.deepEqual(flags(await planCITests(prEnv, pr, wrongParents, noRequest)), all);
  }
  for (const event of [{}, { ...pr, action: 'closed' }, { ...pr, action: 'converted_to_draft' },
    { ...pr, pull_request: { ...pr.pull_request, draft: true } },
    { ...pr, pull_request: { ...pr.pull_request, base: { sha: '0'.repeat(40) } } }]) {
    assert.deepEqual(flags(await planCITests(prEnv, event, noGit, noRequest)), all);
  }
});

test('push must compare complete event range with matching checkout and ancestor', async () => {
  for (const event of [{}, { before }, { after }, { before: after, after },
    { before: '0'.repeat(40), after }, { before, after: head }]) {
    assert.deepEqual(flags(await planCITests(env, event, noGit, noRequest)), all);
  }
  for (const failing of ['rev-parse', 'fetch', 'merge-base', 'diff']) {
    const badGit = args => {
      if (args[0] === failing) throw Error('local fixture unavailable');
      return git()(args);
    };
    assert.deepEqual(flags(await planCITests(env, push, badGit, noRequest)), all);
  }
  assert.deepEqual(flags(await planCITests(env, push, () => head, noRequest)), all);
  for (const malformed of ['', 'truncated', ':100644 100644 abc def M\0README.md']) {
    assert.deepEqual(flags(await planCITests(env, push,
      args => args[0] === 'diff' ? malformed : git()(args), noRequest)), all);
  }
});

test('tag/manual/unknown events and arbitrary scope strings never select a narrow plan', async () => {
  for (const patch of [{ GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/tags/v1' },
    { GITHUB_EVENT_NAME: 'workflow_call' }, { GITHUB_EVENT_NAME: 'merge_group' },
    { GITHUB_REF: 'refs/heads/other' }]) {
    assert.deepEqual(flags(await planCITests({ ...env, ...patch, CI_SCOPE: 'home-ui' }, push,
      noGit, noRequest)), all);
  }
  assert.deepEqual(flags(await planCITests({ ...env, CI_SCOPE: 'home-ui' }, push,
    git(['app/globals.css']), noRequest)), all);
});

test('unknown paths retain core guards and missing baseline never adds unrelated specialties', async () => {
  for (const path of ['app/globals.css', 'components/ui/button.tsx', 'pnpm-lock.yaml']) {
    assert.deepEqual(flags(await planCITests(env, push, git([path]), noRequest)), all);
  }
  assert.deepEqual(flags(await planCITests(env, push, git(['lib/physics-lab/state.ts']), request())),
    { ...none, physics: true });
  assert.deepEqual(flags(await planCITests(env, push, git(['lib/physics-lab/state.ts']),
    request(undefined, jobs([{ ...ci, conclusion: 'cancelled' }])))), { ...none, physics: true });
  const symlink = args => args[0] === 'diff'
    ? ':100644 120000 abc def T\0components/layout/site-footer.tsx\0' : git()(args);
  assert.deepEqual(flags(await planCITests(env, push, symlink, noRequest)), all);
});

test('home selection requires immutable source fingerprint inspection', async () => {
  const paths = ['components/home/home-showcase.tsx'];
  assert.deepEqual(flags(await planCITests(prEnv, pr, git(paths), noRequest)), none);
  const changed = args => args[0] === 'show' && args[1] !== '-s'
    ? `${git(paths)(args)}\nimport './unreviewed';` : git(paths)(args);
  assert.deepEqual(flags(await planCITests(prEnv, pr, changed, noRequest)), all);
});

test('CLI malformed event emits explicit safe flags and honest summary without secret text', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-plan-test-'));
  try {
    const eventPath = join(dir, 'event.json'), output = join(dir, 'output'), summary = join(dir, 'summary');
    writeFileSync(eventPath, '{broken local-test-secret');
    const log = execFileSync(process.execPath, ['scripts/ci-test-plan.mjs'], { encoding: 'utf8',
      env: { ...process.env, GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: eventPath,
        GITHUB_TOKEN: env.GITHUB_TOKEN, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary } });
    assert.equal(readFileSync(output, 'utf8'), 'physics=true\nproject-video=true\nbuilding=true\nvoice=true\n'
      + 'smoke-home=true\nsmoke-playground=true\nsmoke-nature=true\nguides=true\nassets=true\nstore-db=true\nunit-mode=full\n');
    const text = readFileSync(summary, 'utf8');
    assert.match(text, /physics: selected/);
    assert.ok(!`${log}${text}`.includes(env.GITHUB_TOKEN));
    assert.match(readFileSync('scripts/ci-test-plan.mjs', 'utf8'), /not run \(not reported as passed\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Regression for the exact payment repair that previously launched every heavy fixture.
test('payment repair with executable DB test and pinned SQL selects only commerce checks', async () => {
  const migration = 'supabase/migrations/20261027003000_store_payment_crypto_schema.sql';
  const paths = ['docs/STORE_CHANNEL_FULFILLMENT_DECISION.md',
    'lib/store/payments/alipay.ts', 'lib/store/payments/alipay.test.ts'];
  const paymentGit = args => args[0] === 'diff'
    ? raw(paths) + ':100755 100755 abc def M\0scripts/test-store-native.mjs\0'
      + `:000000 100644 000 def A\0${migration}\0`
    : git(paths)(args);
  const selected = await planCIChecks(env, push, paymentGit, request());
  assert.deepEqual(flags(await planCITests(env, push, paymentGit, request())), none);
  assert.equal(selected.unitMode, 'related');
  assert.equal(selected.storeDb, true);
  assert.equal(selected.smokePlayground, false);
  assert.equal(selected.smokeNature, false);
  assert.equal(selected.guides, false);
  assert.ok(selected.unitSources.includes('lib/store/native.ts'));
  const tampered = args => args[0] === 'show' && args[1] === `${after}:${migration}`
    ? readFileSync(migration, 'utf8') + '\nSELECT 1;' : paymentGit(args);
  assert.deepEqual(flags(await planCITests(env, push, tampered, noRequest)), none);
  assert.equal((await planCIChecks(env, push, tampered, noRequest)).unitMode, 'full');
});

test('missing main baseline retains full core checks without launching untouched specialties', async () => {
  for (const paths of [['new-file.ts'], ['lib/store/payments/alipay.ts'], ['scripts/ci-test-impact.mjs']]) {
    const selected = await planCIChecks(env, push, git(paths), noRequest);
    assert.deepEqual(flags(await planCITests(env, push, git(paths), noRequest)), none);
    assert.equal(selected.unitMode, 'full');
    assert.equal(selected.storeDb, paths.some(path => path.startsWith('lib/store/')));
    assert.equal(selected.smokeHome, true);
  }
});
