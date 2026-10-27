import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSourceProof, recordSourceProof, validProof } from './ci-source-proof.mjs';
const sha = n => String(n).repeat(40);
function fixture(path = 'app/page.tsx') {
  const env = { GITHUB_EVENT_NAME: 'pull_request', GITHUB_SHA: sha(3), GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '12', GITHUB_RUN_ATTEMPT: '2', GITHUB_WORKFLOW_REF: 'owner/repo/.github/workflows/ci.yml@refs/pull/7/merge' };
  const event = { number: 7, action: 'synchronize', repository: { full_name: 'owner/repo' }, pull_request: { number: 7, draft: false,
    base: { ref: 'main', sha: sha(1), repo: { full_name: 'owner/repo' } }, head: { sha: sha(2), repo: { full_name: 'owner/repo' } } } };
  const git = args => args[0] === 'show' ? `${sha(1)} ${sha(2)}` : args[0] === 'diff'
    ? `:100644 100644 aaaaaaa bbbbbbb M\0${path}\0` : args[1] === 'HEAD' ? sha(3) : sha(4);
  return { env, event, git };
}
test('proof records actual synthetic merge, ordered parents and tree', () => {
  const f = fixture(); const p = createSourceProof(f.env, f.event, 'full', f.git);
  assert.equal(p.checkout_sha, sha(3)); assert.equal(p.tree_sha, sha(4)); assert.ok(validProof(p));
  assert.ok(!validProof({ ...p, extra: true }));
});
test('docs profile requires independently classified allowlisted prose', () => {
  const f = fixture('README.md'); assert.equal(createSourceProof(f.env, f.event, 'docs', f.git).profile, 'docs');
  assert.throws(() => createSourceProof(f.env, f.event, 'full', f.git));
  const app = fixture(); assert.throws(() => createSourceProof(app.env, app.event, 'docs', app.git));
});
test('draft, fork, wrong checkout, wrong parents and malformed ids reject', () => {
  for (const mutate of [f => { f.event.pull_request.draft = true; }, f => { f.event.pull_request.head.repo.full_name = 'fork/repo'; },
    f => { f.env.GITHUB_SHA = sha(8); }, f => { f.event.pull_request.base.sha = sha(8); }, f => { f.env.GITHUB_RUN_ATTEMPT = '0'; }]) {
    const f = fixture(); mutate(f); assert.throws(() => createSourceProof(f.env, f.event, 'full', f.git));
  }
});
test('failed record removes stale output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proof-')); const output = join(dir, 'source-proof.json');
  try { writeFileSync(output, '{}'); assert.throws(() => recordSourceProof({ env: {}, output, profile: 'full' })); assert.equal(existsSync(output), false); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('record CLI creates nested output directories on a clean runner with an actual merge checkout', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proof-cli-'));
  const git = args => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git(['init', '-q']); git(['config', 'user.name', 'CI proof test']); git(['config', 'user.email', 'ci@example.invalid']);
    writeFileSync(join(dir, 'README.md'), 'base\n'); git(['add', '.']); git(['commit', '-qm', 'base']);
    const base = git(['rev-parse', 'HEAD']);
    git(['checkout', '-qb', 'pr']); writeFileSync(join(dir, 'README.md'), 'updated\n'); git(['commit', '-qam', 'prose']);
    const head = git(['rev-parse', 'HEAD']);
    git(['checkout', '-q', '--detach', base]); git(['merge', '--no-ff', '-qm', 'synthetic merge', head]);
    const checkout = git(['rev-parse', 'HEAD']);
    const f = fixture();
    f.event.pull_request.base.sha = base; f.event.pull_request.head.sha = head;
    const eventPath = join(dir, 'event.json'); writeFileSync(eventPath, JSON.stringify(f.event));
    const output = join(dir, 'runner-temp', 'ci-source-proof', 'source-proof.json');
    const githubOutput = join(dir, 'github-output');
    assert.equal(existsSync(join(dir, 'runner-temp')), false);
    execFileSync(process.execPath, [fileURLToPath(new URL('./ci-source-proof.mjs', import.meta.url)),
      'record', '--output', output, '--profile', 'docs'], { cwd: dir, encoding: 'utf8',
      env: { ...process.env, ...f.env, GITHUB_SHA: checkout, GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: githubOutput } });
    const proof = JSON.parse(readFileSync(output, 'utf8'));
    assert.ok(validProof(proof)); assert.equal(proof.checkout_sha, checkout);
    assert.equal(proof.tree_sha, git(['rev-parse', 'HEAD^{tree}']));
    assert.equal(proof.base_sha, base); assert.equal(proof.head_sha, head); assert.equal(proof.profile, 'docs');
    assert.equal(readFileSync(githubOutput, 'utf8'), 'artifact-name=ci-source-proof-12-2\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
