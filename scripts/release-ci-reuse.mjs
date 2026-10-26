import { appendFileSync, lstatSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { detectScope } from './ci-scope.mjs';
import { artifactName, gitDefault, isId, isRepository, isSha, validProof, WORKFLOW } from './ci-source-proof.mjs';

const MAX_BYTES = 65536;
const fallback = () => ({ reuse: false, reason: 'PR source evidence unavailable or no longer current; running Release checks' });
function requireValue(condition) { if (!condition) throw Error('Evidence unavailable'); }
export function githubApi(env, request = fetch) {
  let requests = 0;
  requireValue(isRepository(env.GITHUB_REPOSITORY) && env.GITHUB_TOKEN);
  return async path => {
    requireValue(path.startsWith('/') && !path.includes('://') && ++requests <= 40);
    const response = await request(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' }, redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    requireValue(response.ok);
    return response.json();
  };
}
async function pages(api, path, key) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const data = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const items = key ? data?.[key] : data;
    requireValue(Array.isArray(items) && items.length <= 100);
    all.push(...items);
    if (key) {
      requireValue(Number.isSafeInteger(data.total_count) && data.total_count >= all.length);
      if (all.length === data.total_count) return all;
      requireValue(items.length === 100);
    } else if (items.length < 100) return all;
  }
  throw Error('Incomplete pagination');
}
function releaseIdentity(env, git) {
  requireValue(env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === 'refs/heads/main'
    && isRepository(env.GITHUB_REPOSITORY) && isSha(env.GITHUB_SHA) && isSha(env.RELEASE_BEFORE)
    && git(['rev-parse', 'HEAD']).trim() === env.GITHUB_SHA);
  const parents = git(['show', '-s', '--format=%P', 'HEAD']).trim().split(/\s+/);
  const tree = git(['rev-parse', 'HEAD^{tree}']).trim();
  requireValue(parents.length === 2 && parents.every(isSha) && parents[0] === env.RELEASE_BEFORE && isSha(tree));
  return { repository: env.GITHUB_REPOSITORY, release_sha: env.GITHUB_SHA, base_sha: parents[0], head_sha: parents[1], tree_sha: tree };
}
function validPr(pr, identity) {
  return pr?.merged === true && pr.draft === false && isId(pr.number)
    && pr.base?.ref === 'main' && pr.base?.repo?.full_name === identity.repository
    && pr.head?.repo?.full_name === identity.repository && pr.head?.sha === identity.head_sha
    && pr.merge_commit_sha === identity.release_sha;
}
function validRun(run, identity, env) {
  return isId(run?.id) && isId(run.run_attempt) && String(run.id) !== env.GITHUB_RUN_ID
    && run.path === WORKFLOW && run.event === 'pull_request' && run.head_sha === identity.head_sha
    && run.repository?.full_name === identity.repository && run.head_repository?.full_name === identity.repository
    && run.status === 'completed' && run.conclusion === 'success';
}
async function findCandidate(env, git, api) {
  const identity = releaseIdentity(env, git);
  const linked = await pages(api, `/commits/${identity.release_sha}/pulls`);
  requireValue(linked.length === 1 && isId(linked[0]?.number));
  const pr = await api(`/pulls/${linked[0].number}`);
  requireValue(validPr(pr, identity));
  const runs = await pages(api, `/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${identity.head_sha}`, 'workflow_runs');
  requireValue(runs.every(run => isId(run?.id)));
  // Do not filter for success: a newer failure or in-progress rerun revokes earlier evidence.
  const latest = [...runs].sort((a, b) => b.id - a.id)[0];
  requireValue(validRun(latest, identity, env));
  const run = await api(`/actions/runs/${latest.id}`);
  requireValue(validRun(run, identity, env) && run.id === latest.id && run.run_attempt === latest.run_attempt);
  const jobs = await pages(api, `/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs');
  const checks = jobs.filter(job => job.name === 'test-and-lint');
  requireValue(checks.length === 1 && checks[0].status === 'completed' && checks[0].conclusion === 'success'
    && checks[0].run_attempt === run.run_attempt && checks[0].head_sha === identity.head_sha);
  const name = artifactName(run.id, run.run_attempt);
  const artifacts = await pages(api, `/actions/runs/${run.id}/artifacts`, 'artifacts');
  const matches = artifacts.filter(artifact => artifact.name === name);
  requireValue(matches.length === 1);
  const artifact = matches[0];
  requireValue(isId(artifact.id) && artifact.expired === false && Number.isSafeInteger(artifact.size_in_bytes)
    && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= MAX_BYTES);
  return { ...identity, pr: pr.number, run_id: run.id, run_attempt: run.run_attempt,
    artifact_id: artifact.id, artifact_name: name, artifact_size: artifact.size_in_bytes };
}
export async function findReuse({ env = process.env, git = gitDefault, api, request } = {}) {
  try {
    const candidate = await findCandidate(env, git, api ?? githubApi(env, request));
    return { reuse: false, candidate, reason: 'Candidate PR run found; checkout proof still requires verification' };
  } catch { return fallback(); }
}
export function readSmallJson(path) {
  const stat = lstatSync(path);
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= MAX_BYTES);
  return JSON.parse(readFileSync(path, 'utf8'));
}
export async function verifyReuse({ env = process.env, git = gitDefault, api, request, candidate, proof } = {}) {
  try {
    const get = api ?? githubApi(env, request);
    requireValue(validProof(proof));
    const current = await findCandidate(env, git, get);
    requireValue(candidate && Object.keys(candidate).length === Object.keys(current).length
      && Object.entries(current).every(([key, value]) => candidate[key] === value));
    requireValue(proof.repository === current.repository && proof.pr === current.pr
      && proof.run_id === current.run_id && proof.run_attempt === current.run_attempt
      && proof.base_sha === current.base_sha && proof.head_sha === current.head_sha && proof.tree_sha === current.tree_sha);
    const scope = detectScope({ ...env, GITHUB_EVENT_NAME: 'pull_request' }, { action: 'synchronize',
      pull_request: { draft: false, base: { sha: current.base_sha }, head: { sha: current.head_sha } } }, git);
    requireValue(scope.mode === proof.profile);
    // The tested synthetic merge can differ from the final merge SHA. Compare its actual object,
    // not the run/check-suite head SHA (GitHub reports the PR head there).
    const commit = await get(`/git/commits/${proof.checkout_sha}`);
    requireValue(commit.sha === proof.checkout_sha && commit.tree?.sha === proof.tree_sha
      && Array.isArray(commit.parents) && commit.parents.length === 2
      && commit.parents[0]?.sha === proof.base_sha && commit.parents[1]?.sha === proof.head_sha);
    return { reuse: true, sourceRunId: current.run_id,
      reason: `Reusing verified ${proof.profile} PR checks: https://github.com/${current.repository}/actions/runs/${current.run_id}/attempts/${current.run_attempt}` };
  } catch { return fallback(); }
}
function output(env, result) {
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT,
    `reuse=${result.reuse}\nsource-run-id=${result.sourceRunId ?? ''}\nrun-id=${result.candidate?.run_id ?? ''}\nartifact-name=${result.candidate?.artifact_name ?? ''}\n`);
  console.info(result.reason);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `Release CI: ${result.reason}.\n`);
}
export async function main(args, env = process.env) {
  let result = fallback();
  try {
    requireValue(args[1] === '--candidate' && args[2]);
    if (args[0] === 'find' && args.length === 3) {
      rmSync(args[2], { force: true });
      result = await findReuse({ env });
      if (result.candidate) writeFileSync(args[2], `${JSON.stringify(result.candidate)}\n`, { flag: 'wx' });
    } else if (args[0] === 'verify' && args.length === 5 && args[3] === '--proof-dir') {
      result = await verifyReuse({ env, candidate: readSmallJson(args[2]), proof: readSmallJson(join(args[4], 'source-proof.json')) });
    }
  } catch { result = fallback(); }
  output(env, result);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
