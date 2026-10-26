import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseChanges, classifyHomeChanges } from './ci-scope.mjs';
import { classifyTestImpact, classifyCoreTestImpact, fullCoreTestImpact } from './ci-test-impact.mjs';

const full = reason => ({ physics: true, projectVideo: true, building: true, voice: true, reason,
  ...fullCoreTestImpact() });
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && !/^0+$/.test(value);
const runId = value => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
const gitDefault = args => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000,
});

async function testedMainBase(env, before, request) {
  if (typeof env.GITHUB_TOKEN !== 'string' || !env.GITHUB_TOKEN.trim()
      || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY ?? '')
      || ['.', '..'].includes(env.GITHUB_REPOSITORY.split('/')[1])
      || !runId(env.GITHUB_RUN_ID)) return false;
  const root = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/runs`;
  const get = async url => {
    const response = await request(url, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' },
      redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw Error('Baseline response unavailable');
    return response.json();
  };
  const history = await get(`${root}?head_sha=${before}&event=push&per_page=10`);
  if (!Array.isArray(history.workflow_runs) || history.total_count !== history.workflow_runs.length
      || history.workflow_runs.some(run => !run || !Number.isSafeInteger(run.id) || run.id < 1
        || run.head_sha !== before || run.event !== 'push')) return false;
  const candidates = history.workflow_runs.filter(run => String(run.id) !== env.GITHUB_RUN_ID
    && run.path === '.github/workflows/release.yml' && run.head_branch === 'main'
    && run.event === 'push' && run.head_sha === before);
  // Reruns reuse the run id. Inspect its latest job attempt, never an older green
  // attempt or a successful older Release when the most recent CI did not pass.
  const previous = candidates.sort((a, b) => b.id - a.id)[0];
  if (!previous || previous.id >= Number(env.GITHUB_RUN_ID)) return false;
  const data = await get(`${root}/${previous.id}/jobs?filter=latest&per_page=100`);
  if (!Array.isArray(data.jobs) || data.total_count !== data.jobs.length
      || data.jobs.some(job => !job || typeof job.name !== 'string')) return false;
  const ci = data.jobs.filter(job => job.name === 'ci / test-and-lint');
  return ci.length === 1 && ci[0].status === 'completed' && ci[0].conclusion === 'success';
}

export async function planCIChecks(env = process.env, event = {}, git = gitDefault, request = fetch) {
  try {
    let before, after;
    const mainPush = env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === 'refs/heads/main';
    if (env.GITHUB_EVENT_NAME === 'pull_request') {
      const pr = event.pull_request;
      if (!['opened', 'synchronize', 'reopened', 'ready_for_review'].includes(event.action)
          || pr?.draft !== false || !sha(pr.base?.sha) || !sha(pr.head?.sha) || !sha(env.GITHUB_SHA)) {
        return full('Missing or inconsistent PR comparison metadata');
      }
      before = pr.base.sha; after = env.GITHUB_SHA;
      if (git(['rev-parse', 'HEAD']).trim() !== after) return full('Checkout does not match PR merge');
      const parents = git(['show', '-s', '--format=%P', 'HEAD']).trim().split(' ');
      if (parents.length !== 2 || parents[0] !== before || parents[1] !== pr.head.sha) {
        return full('PR merge parents do not match event');
      }
    } else if (mainPush) {
      before = event.before; after = event.after;
      if (!sha(before) || !sha(after) || before === after || after !== env.GITHUB_SHA) {
        return full('Missing or inconsistent complete push comparison');
      }
      if (git(['rev-parse', 'HEAD']).trim() !== after) return full('Checkout does not match push');
      git(['fetch', '--no-tags', '--depth=1', 'origin', before]);
      git(['merge-base', '--is-ancestor', before, after]);
    } else return full('Manual, tag or unknown event requires every specialty');

    const changes = parseChanges(git(['diff', '--raw', '--no-renames', '--no-ext-diff', '-z', before, after, '--']));
    let selection = classifyTestImpact(changes);
    if (classifyHomeChanges(changes, before, after, git).mode === 'home-ui') {
      selection = { physics: false, projectVideo: false, building: false, voice: false,
        reason: 'Reviewed homepage changes with pinned dependencies; specialties not run' };
    }
    if (mainPush && Object.values(selection).some(value => value === false)
        && !await testedMainBase(env, before, request)) {
      return full('Exact preceding main CI baseline unavailable; run every specialty');
    }
    const core = classifyCoreTestImpact(changes);
    // Release always executes every unit test. Its successful CI job can then
    // remain the exact source baseline for future main comparisons.
    if (mainPush) { core.unitMode = 'full'; core.unitSources = []; core.unitOwners = []; }
    return { ...selection, ...core };
  } catch {
    // Do not include API bodies, request headers, environment values or thrown
    // errors in outputs: a failing request may contain credentials or data.
    return full('Comparison or prior CI verification unavailable; run every specialty');
  }
}

// Keep the original four-specialty public contract for existing callers.
export async function planCITests(...args) {
  const { physics, projectVideo, building, voice, reason } = await planCIChecks(...args);
  return { physics, projectVideo, building, voice, reason };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let selection;
  try {
    const event = ['pull_request', 'push'].includes(process.env.GITHUB_EVENT_NAME)
      ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
    selection = await planCIChecks(process.env, event);
  } catch { selection = full('Event unavailable or invalid; run every specialty'); }
  const names = [['physics', 'physics'], ['projectVideo', 'project-video'], ['building', 'building'], ['voice', 'voice'],
    ['smokeHome', 'smoke-home'], ['smokePlayground', 'smoke-playground'], ['smokeNature', 'smoke-nature'],
    ['guides', 'guides'], ['assets', 'assets']];
  console.info(`CI specialties: ${selection.reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    names.map(([key, output]) => `${output}=${selection[key]}\n`).join('') + `unit-mode=${selection.unitMode}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `CI specialty plan: ${selection.reason}.\n`
    + names.map(([key, label]) => `- ${label}: ${selection[key] ? 'selected' : 'not run (not reported as passed)'}\n`).join('')
    + `Units: ${selection.unitMode === 'related' ? 'dependency graph plus affected owner suites, changed tests and global source contracts' : 'full suite'}.\n`
    + 'Core lint, types, health/login/auth smoke, PR build and route security checks retain their existing gates.\n');
}
