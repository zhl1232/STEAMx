import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findReuse, verifyReuse, githubApi, readSmallJson } from './release-ci-reuse.mjs';
const sha = n => String(n).repeat(40);
function fixture(profile = 'full') {
  const env = { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha(3), RELEASE_BEFORE: sha(1),
    GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '100', GITHUB_TOKEN: 'never-log-this' };
  const run = { id: 12, run_attempt: 2, path: '.github/workflows/ci.yml', event: 'pull_request', head_sha: sha(2),
    repository: { full_name: env.GITHUB_REPOSITORY }, head_repository: { full_name: env.GITHUB_REPOSITORY }, status: 'completed', conclusion: 'success' };
  const pr = { number: 7, merged: true, draft: false, merge_commit_sha: sha(3),
    base: { ref: 'main', sha: sha(9), repo: { full_name: env.GITHUB_REPOSITORY } },
    head: { sha: sha(2), repo: { full_name: env.GITHUB_REPOSITORY } } };
  const jobs = [{ name: 'test-and-lint', run_attempt: 2, head_sha: sha(2), status: 'completed', conclusion: 'success' }];
  const artifacts = [{ id: 99, name: 'ci-source-proof-12-2', size_in_bytes: 500, expired: false }];
  const proof = { schema: 1, repository: env.GITHUB_REPOSITORY, workflow_path: '.github/workflows/ci.yml', run_id: 12,
    run_attempt: 2, pr: 7, base_sha: sha(1), head_sha: sha(2), checkout_sha: sha(5), tree_sha: sha(4), profile };
  const commit = { sha: sha(5), tree: { sha: sha(4) }, parents: [{ sha: sha(1) }, { sha: sha(2) }] };
  const runs = [run]; const calls = [];
  const api = async path => {
    calls.push(path);
    if (path.startsWith('/commits/')) return [{ number: 7 }];
    if (path === '/pulls/7') return pr;
    if (path.startsWith('/actions/workflows/')) return { workflow_runs: runs, total_count: runs.length };
    if (path.includes('/jobs?')) return { jobs, total_count: jobs.length };
    if (path.includes('/artifacts?')) return { artifacts, total_count: artifacts.length };
    if (path === '/actions/runs/12') return run;
    if (path === `/git/commits/${sha(5)}`) return commit;
    throw Error('unexpected request');
  };
  const git = args => args[0] === 'show' ? `${sha(1)} ${sha(2)}` : args[0] === 'diff'
    ? `:100644 100644 aaaaaaa bbbbbbb M\0${profile === 'docs' ? 'README.md' : 'app/page.tsx'}\0`
    : args[1] === 'HEAD' ? sha(3) : sha(4);
  return { env, git, api, proof, run, runs, pr, jobs, artifacts, commit, calls };
}
async function verify(f, candidate) {
  return verifyReuse({ ...f, candidate: candidate ?? (await findReuse(f)).candidate });
}
test('distinct synthetic and main merge SHAs reuse only with actual matching trees and ordered parents', async () => {
  const f = fixture(); const result = await verify(f); assert.equal(result.reuse, true); assert.match(result.reason, /runs\/12\/attempts\/2/);
  assert.equal(f.pr.base.sha, sha(9)); // API PR base can change after merge; proof base is authoritative.
});
test('docs proof matches independently recomputed scope; lightweight cannot stand in for full', async () => {
  assert.equal((await verify(fixture('docs'))).reuse, true);
  const f = fixture(); f.proof.profile = 'docs'; assert.equal((await verify(f)).reuse, false);
});
test('proof alone never establishes reuse', async () => {
  const f = fixture(); assert.equal((await verifyReuse(f)).reuse, false);
});
test('tree, base, head, schema, workflow, profile, PR and source commit mismatches fall back', async () => {
  for (const [key, value] of [['tree_sha', sha(8)], ['base_sha', sha(8)], ['head_sha', sha(8)], ['schema', 2],
    ['workflow_path', '.github/workflows/other.yml'], ['profile', 'unknown'], ['pr', 8]]) {
    const f = fixture(); f.proof[key] = value; assert.equal((await verify(f)).reuse, false, key);
  }
  for (const mutate of [f => { f.commit.tree.sha = sha(2); }, f => { f.commit.parents.reverse(); },
    f => { f.commit.parents.pop(); }, f => { f.commit.sha = sha(8); }]) {
    const f = fixture(); mutate(f); assert.equal((await verify(f)).reuse, false);
  }
});
test('latest failure, cancelled, in-progress, skipped job and a new attempt revoke earlier success', async () => {
  for (const mutate of [f => { f.runs.push({ ...f.run, id: 13, conclusion: 'failure' }); },
    f => { f.run.status = 'in_progress'; }, f => { f.run.conclusion = 'cancelled'; },
    f => { f.jobs[0].conclusion = 'skipped'; }, f => { f.run.run_attempt++; }, f => { f.jobs[0].run_attempt--; }]) {
    const f = fixture(); const candidate = (await findReuse(f)).candidate; mutate(f); assert.equal((await verify(f, candidate)).reuse, false);
  }
});
test('wrong workflow, fork, missing/expired/oversized/ambiguous artifacts and unavailable API fall back', async () => {
  for (const mutate of [f => { f.run.path = '.github/workflows/other.yml'; }, f => { f.pr.head.repo.full_name = 'fork/repo'; },
    f => { f.artifacts.length = 0; }, f => { f.artifacts[0].expired = true; }, f => { f.artifacts[0].size_in_bytes = 65537; },
    f => { f.artifacts.push({ ...f.artifacts[0] }); }, f => { f.api = async () => { throw Error('token=secret'); }; }]) {
    const f = fixture(); mutate(f); const result = await findReuse(f); assert.equal(result.candidate, undefined); assert.doesNotMatch(result.reason, /secret/);
  }
});
test('tag/manual/direct push and mismatched checkout never query API', async () => {
  for (const mutate of [f => { f.env.GITHUB_REF = 'refs/tags/v1'; }, f => { f.env.GITHUB_EVENT_NAME = 'workflow_dispatch'; },
    f => { f.env.RELEASE_BEFORE = sha(9); }, f => { f.env.GITHUB_SHA = sha(8); }, f => { f.git = () => sha(3); }]) {
    const f = fixture(); mutate(f); assert.equal((await findReuse(f)).candidate, undefined); assert.deepEqual(f.calls, []);
  }
});
test('incomplete pagination fails closed', async () => {
  const f = fixture(); const old = f.api; f.api = async path => path.includes('/runs?') ? { workflow_runs: [f.run], total_count: 101 } : old(path);
  assert.equal((await findReuse(f)).candidate, undefined);
});
test('API uses fixed origin, timeout and redirect rejection; errors are contained', async () => {
  const f = fixture(); const request = async (url, options) => { assert.match(url, /^https:\/\/api.github.com\/repos\/owner\/repo\//);
    assert.equal(options.redirect, 'error'); assert.ok(options.signal); return { ok: false }; };
  assert.equal((await findReuse({ ...f, api: undefined, request })).candidate, undefined);
  assert.throws(() => githubApi({ ...f.env, GITHUB_TOKEN: '' }));
});
test('small JSON reader rejects oversized, malformed, missing and symlink proof', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reuse-')); const file = join(dir, 'proof');
  try { assert.throws(() => readSmallJson(file)); writeFileSync(file, 'x'.repeat(65537)); assert.throws(() => readSmallJson(file));
    writeFileSync(file, '{'); assert.throws(() => readSmallJson(file)); writeFileSync(file, '{}'); symlinkSync(file, join(dir, 'link'));
    assert.throws(() => readSmallJson(join(dir, 'link'))); assert.deepEqual(readSmallJson(file), {});
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('home-ui rechecks pinned source imports and shape on both immutable trees', async () => {
  const f = fixture('home-ui');
  const source = readFileSync(new URL('../components/home/home-showcase.tsx', import.meta.url), 'utf8');
  const original = f.git;
  f.git = args => args[0] === 'show' && args[1]?.includes(':') ? source : args[0] === 'diff'
    ? ':100644 100644 aaaaaaa bbbbbbb M\0components/home/home-showcase.tsx\0' : original(args);
  assert.equal((await verify(f)).reuse, true);
  const good = f.git;
  f.git = args => args[0] === 'show' && args[1]?.includes(':') ? `import 'unreviewed';\n${source}` : good(args);
  assert.equal((await verify(f)).reuse, false);
});
