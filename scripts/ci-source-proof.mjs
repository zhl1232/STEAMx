import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { detectScope } from './ci-scope.mjs';

export const WORKFLOW = '.github/workflows/ci.yml';
export const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && !/^0+$/.test(value);
export const isId = value => Number.isSafeInteger(value) && value > 0;
export const isRepository = value => typeof value === 'string' && /^[\w.-]+\/[\w.-]+$/.test(value);
export const gitDefault = args => execFileSync('git', args, { encoding: 'utf8', timeout: 15_000, maxBuffer: 8 * 1024 * 1024 });
export const artifactName = (id, attempt) => `ci-source-proof-${id}-${attempt}`;
const keys = ['schema', 'repository', 'workflow_path', 'run_id', 'run_attempt', 'pr', 'head_sha', 'base_sha', 'checkout_sha', 'tree_sha', 'profile'];
export function validProof(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
    && value.schema === 1 && isRepository(value.repository) && value.workflow_path === WORKFLOW
    && ['run_id', 'run_attempt', 'pr'].every(key => isId(value[key]))
    && ['head_sha', 'base_sha', 'checkout_sha', 'tree_sha'].every(key => isSha(value[key])) && ['full', 'home-ui', 'docs'].includes(value.profile);
}
export function createSourceProof(env, event, profile, git = gitDefault) {
  const pr = event?.pull_request;
  if (env.GITHUB_EVENT_NAME !== 'pull_request' || !['full', 'home-ui', 'docs'].includes(profile) || !isRepository(env.GITHUB_REPOSITORY)
    || !env.GITHUB_WORKFLOW_REF?.startsWith(`${env.GITHUB_REPOSITORY}/${WORKFLOW}@`)
    || !pr || pr.draft !== false || pr.base?.ref !== 'main' || pr.base?.repo?.full_name !== env.GITHUB_REPOSITORY
    || pr.head?.repo?.full_name !== env.GITHUB_REPOSITORY || event.repository?.full_name !== env.GITHUB_REPOSITORY
    || !isId(pr.number) || event.number !== pr.number || !isSha(pr.base.sha) || !isSha(pr.head.sha)) {
    throw Error('PR identity or full profile unavailable');
  }
  const checkout = git(['rev-parse', 'HEAD']).trim();
  const parents = git(['show', '-s', '--format=%P', 'HEAD']).trim().split(/\s+/);
  const proof = { schema: 1, repository: env.GITHUB_REPOSITORY, workflow_path: WORKFLOW,
    run_id: Number(env.GITHUB_RUN_ID), run_attempt: Number(env.GITHUB_RUN_ATTEMPT), pr: pr.number,
    head_sha: pr.head.sha, base_sha: pr.base.sha, checkout_sha: checkout,
    tree_sha: git(['rev-parse', 'HEAD^{tree}']).trim(), profile };
  if (checkout !== env.GITHUB_SHA || parents.length !== 2 || parents[0] !== proof.base_sha
    || parents[1] !== proof.head_sha || !validProof(proof)
    || detectScope(env, event, git).mode !== profile) throw Error('Checkout merge identity unavailable');
  return proof;
}
export function recordSourceProof({ env = process.env, output, profile, git = gitDefault }) {
  if (!output) throw Error('Output path required');
  // Never leave an earlier proof behind when this invocation cannot establish evidence.
  rmSync(output, { force: true });
  const proof = createSourceProof(env, JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')), profile, git);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(proof)}\n`, { flag: 'wx' });
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `artifact-name=${artifactName(proof.run_id, proof.run_attempt)}\n`);
  return proof;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  try {
    if (args[0] !== 'record' || args.length !== 5 || args[1] !== '--output' || args[3] !== '--profile') throw Error();
    recordSourceProof({ output: args[2], profile: args[4] });
    console.info('Recorded actual PR merge checkout evidence');
  } catch {
    console.error('CI source proof unavailable: PR identity, checkout or output validation failed');
    process.exitCode = 1;
  }
}
