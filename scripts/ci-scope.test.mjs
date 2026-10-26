import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DOC_PATHS, detectScope, parseChanges } from './ci-scope.mjs';

const base = 'a'.repeat(40), head = 'b'.repeat(40), merge = 'c'.repeat(40);
const env = { GITHUB_EVENT_NAME: 'pull_request', GITHUB_SHA: merge };
const event = (action = 'opened', draft = false) => ({ action,
  pull_request: { draft, base: { sha: base }, head: { sha: head } } });
const raw = (path, oldMode = '100644', newMode = '100644', status = 'M') =>
  `:${oldMode} ${newMode} abc def ${status}\0${path}\0`;
const git = (diff = raw('README.md')) => (args) => {
  if (args[0] === 'rev-parse') return merge;
  if (args[0] === 'show') return `${base} ${head}`;
  assert.deepEqual(args, ['diff', '--raw', '--no-renames', '--no-ext-diff', '-z', base, merge, '--']);
  return diff;
};

for (const action of ['opened', 'synchronize', 'reopened', 'converted_to_draft']) {
  test(`draft ${action} is cheap, including code`, () => {
    assert.equal(detectScope(env, event(action, true), git(raw('app/page.tsx'))).mode, 'draft');
  });
}
for (const action of ['opened', 'synchronize', 'reopened']) {
  test(`non-draft ${action} classifies docs but never arbitrary code`, () => {
    assert.equal(detectScope(env, event(action), git()).mode, 'docs');
    assert.equal(detectScope(env, event(action), git(raw('app/page.tsx'))).mode, 'full');
  });
}
test('ready reclassifies docs cheaply but code and stale draft metadata fully', () => {
  assert.equal(detectScope(env, event('ready_for_review'), git()).mode, 'docs');
  assert.equal(detectScope(env, event('ready_for_review'), git(raw('app/page.tsx'))).mode, 'full');
  assert.equal(detectScope(env, event('ready_for_review', true), git()).mode, 'full');
});
test('reviewed allowlist supports normal add/edit/delete only', () => {
  for (const path of DOC_PATHS) {
    for (const [old, next, status] of [['100644', '100644', 'M'], ['000000', '100644', 'A'], ['100644', '000000', 'D']]) {
      assert.equal(detectScope(env, event(), git(raw(path, old, next, status))).mode, 'docs');
    }
    for (const mode of ['120000', '100755', '160000']) {
      assert.equal(detectScope(env, event(), git(raw(path, '100644', mode, 'T'))).mode, 'full');
    }
  }
});
test('code, shared/security/data/config/tests and unknown docs fail closed', () => {
  for (const path of ['app/page.tsx', 'app/about/page.tsx', 'components/ui/button.tsx', 'lib/auth.ts',
    'lib/store/payments.ts', 'lib/ai/tutor/usage.ts', 'supabase/migrations/change.sql', 'package.json',
    'pnpm-lock.yaml', '.github/workflows/ci.yml', 'scripts/ci-scope.mjs', 'scripts/ci-scope.test.mjs',
    'e2e/smoke.spec.ts', 'docs/example.md', 'docs/data.json', 'docs/script.sh', 'README.md\napp/page.tsx']) {
    assert.equal(detectScope(env, event(), git(raw('README.md') + raw(path))).mode, 'full', path);
  }
  // Rename is represented as delete + add; a code deletion cannot hide behind a doc target.
  assert.equal(detectScope(env, event(), git(raw('app/old.ts', '100644', '000000', 'D') + raw('README.md', '000000', '100644', 'A'))).mode, 'full');
});
test('main/tag/manual/call/merge queue events always validate full', () => {
  for (const name of ['push', 'workflow_dispatch', 'workflow_call', 'merge_group', undefined]) {
    for (const ref of ['refs/heads/main', 'refs/tags/v1']) {
      assert.equal(detectScope({ ...env, GITHUB_EVENT_NAME: name, GITHUB_REF: ref }, event(), () => { throw Error('unused'); }).mode, 'full');
    }
  }
});
test('invalid events, diff, checkout or missing objects cannot produce a cheap success', () => {
  for (const payload of [{}, event('edited'), event('converted_to_draft'), { ...event(), pull_request: {} }]) {
    assert.equal(detectScope(env, payload, git()).mode, 'full');
  }
  for (const diff of ['', raw('README.md').slice(0, -1), 'garbage\0', ':100644 100644 abc def R100\0README.md\0']) {
    for (const draft of [true, false]) assert.equal(detectScope(env, event('opened', draft), git(diff)).mode, 'full');
  }
  for (const command of ['rev-parse', 'show', 'diff']) {
    assert.equal(detectScope(env, event(), (args) => args[0] === command ? 'bad' : git()(args)).mode, 'full');
  }
  assert.equal(detectScope(env, event(), () => { throw Error('missing objects'); }).mode, 'full');
  assert.throws(() => parseChanges(''));
});
test('actual synthetic merge diff works with Git, including a deleted application file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-scope-'));
  const run = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    run(['init', '-q']); run(['config', 'user.email', 'test@example.invalid']); run(['config', 'user.name', 'Local test']);
    writeFileSync(join(dir, 'README.md'), 'base\n'); writeFileSync(join(dir, 'app.ts'), 'code\n');
    run(['add', '.']); run(['commit', '-qm', 'base']); const b = run(['rev-parse', 'HEAD']);
    run(['checkout', '-qb', 'pr']); writeFileSync(join(dir, 'README.md'), 'docs\n');
    run(['commit', '-qam', 'docs']); const h = run(['rev-parse', 'HEAD']);
    run(['checkout', '-q', '--detach', b]); run(['merge', '--no-ff', '-qm', 'merge', h]);
    const m = run(['rev-parse', 'HEAD']);
    const payload = { ...event(), pull_request: { draft: false, base: { sha: b }, head: { sha: h } } };
    const localGit = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(detectScope({ ...env, GITHUB_SHA: m }, payload, localGit).mode, 'docs');
    run(['checkout', '-q', 'pr']); rmSync(join(dir, 'app.ts')); run(['commit', '-qam', 'delete code']);
    payload.pull_request.head.sha = run(['rev-parse', 'HEAD']); run(['checkout', '-q', '--detach', b]);
    run(['merge', '--no-ff', '-qm', 'merge code deletion', 'pr']);
    assert.equal(detectScope({ ...env, GITHUB_SHA: run(['rev-parse', 'HEAD']) }, payload, localGit).mode, 'full');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('CLI malformed event falls back to full without network access', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-event-'));
  try {
    const path = join(dir, 'event.json'), output = join(dir, 'output');
    writeFileSync(path, '{invalid');
    execFileSync(process.execPath, ['scripts/ci-scope.mjs'], { env: { ...process.env,
      GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: path, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: '' } });
    assert.equal(readFileSync(output, 'utf8'), 'mode=full\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
