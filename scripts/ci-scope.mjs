import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { HOME_PATHS, isReviewedHomeChange } from './home-ui-scope.mjs';

// Reviewed prose only; never infer safety from a .md suffix or docs/ prefix.
export const DOC_PATHS = new Set([
  'AGENTS.md', 'README.md', 'PROJECT_INDEX.md', 'docs/README.md', 'docs/deployment.md',
]);
const full = (reason) => ({ mode: 'full', reason });
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const gitDefault = (args) => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000,
});

export function parseChanges(raw) {
  if (!raw || !raw.endsWith('\0')) throw Error('Missing or truncated diff');
  const fields = raw.slice(0, -1).split('\0');
  if (fields.length % 2) throw Error('Malformed diff');
  const changes = [];
  for (let i = 0; i < fields.length; i += 2) {
    const match = /^:(\d{6}) (\d{6}) [a-f0-9]+ [a-f0-9]+ ([AMDT])$/.exec(fields[i]);
    if (!match || !fields[i + 1]) throw Error('Unexpected diff record');
    changes.push({ path: fields[i + 1], oldMode: match[1], newMode: match[2] });
  }
  return changes;
}

export function classifyHomeChanges(changes, before, after, git) {
  if (!changes.length || !changes.some(change => HOME_PATHS.has(change.path))) return full('No reviewed homepage changes');
  try {
    const safe = changes.every(change => DOC_PATHS.has(change.path)
      ? ['000000', '100644'].includes(change.oldMode) && ['000000', '100644'].includes(change.newMode)
      : isReviewedHomeChange(change, before, after, git));
    return safe ? { mode: 'home-ui', reason: 'Reviewed homepage-only changes with pinned imports; independent specialties not run' }
      : full('Unknown/shared paths, file modes or dependency changes');
  } catch { return full('Homepage dependency inspection unavailable'); }
}

export function detectReleaseCI(env, git = gitDefault) {
  // Only the trusted release-scope job can request this profile. Recheck its exact
  // SHA and complete before..after delta; workflow_call defaults to full.
  if (env.CI_PROFILE !== 'home-ui' || env.GITHUB_EVENT_NAME !== 'push'
      || env.GITHUB_REF !== 'refs/heads/main' || env.CI_VERIFIED_SHA !== env.GITHUB_SHA
      || !sha(env.CI_BEFORE) || /^0+$/.test(env.CI_BEFORE) || !sha(env.GITHUB_SHA)
      || env.CI_BEFORE === env.GITHUB_SHA) return full('Release profile unavailable or forced full');
  try {
    if (git(['rev-parse', 'HEAD']).trim() !== env.GITHUB_SHA) throw Error('Checkout mismatch');
    git(['fetch', '--no-tags', '--depth=1', 'origin', env.CI_BEFORE]);
    const changes = parseChanges(git(['diff', '--raw', '--no-renames', '--no-ext-diff', '-z',
      env.CI_BEFORE, env.GITHUB_SHA, '--']));
    return classifyHomeChanges(changes, env.CI_BEFORE, env.GITHUB_SHA, git);
  } catch { return full('Release comparison unavailable'); }
}

export function detectScope(env = process.env, event = {}, git = gitDefault) {
  // workflow_call inherits the caller event; only a verified main release can request home-ui.
  if (env.GITHUB_EVENT_NAME !== 'pull_request') return detectReleaseCI(env, git);
  const pr = event.pull_request;
  if (!pr || typeof pr.draft !== 'boolean' || !sha(pr.base?.sha) || !sha(pr.head?.sha)
      || !sha(env.GITHUB_SHA)) return full('Incomplete PR metadata');
  if (!['opened', 'synchronize', 'reopened', 'ready_for_review', 'converted_to_draft'].includes(event.action)) {
    return full('Unknown PR activity');
  }
  if (event.action === 'ready_for_review' && pr.draft) return full('Inconsistent ready metadata');
  if (event.action === 'converted_to_draft' && !pr.draft) return full('Inconsistent draft metadata');
  try {
    // Checkout the exact synthetic merge, not a moving branch or cached PR result.
    if (git(['rev-parse', 'HEAD']).trim() !== env.GITHUB_SHA) throw Error('Checkout SHA mismatch');
    const parents = git(['show', '-s', '--format=%P', 'HEAD']).trim().split(' ');
    if (parents.length !== 2 || parents[0] !== pr.base.sha || parents[1] !== pr.head.sha) {
      throw Error('Merge parents do not match event');
    }
    const changes = parseChanges(git([
      'diff', '--raw', '--no-renames', '--no-ext-diff', '-z', pr.base.sha, env.GITHUB_SHA, '--',
    ]));
    if (pr.draft) return { mode: 'draft', reason: 'Draft PR; reclassify when ready' };
    const proseOnly = changes.every(({ path, oldMode, newMode }) => DOC_PATHS.has(path)
      && ['000000', '100644'].includes(oldMode) && ['000000', '100644'].includes(newMode));
    if (proseOnly) return { mode: 'docs', reason: 'Only explicitly allowlisted prose changed' };
    return classifyHomeChanges(changes, pr.base.sha, env.GITHUB_SHA, git);
  } catch {
    return full('Comparison unavailable or invalid; validate conservatively');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let result;
  try {
    const event = process.env.GITHUB_EVENT_NAME === 'pull_request'
      ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
    result = detectScope(process.env, event);
  } catch {
    result = full('Event unavailable or invalid; validate conservatively');
  }
  console.log(`CI scope: ${result.mode} — ${result.reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mode=${result.mode}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `CI scope: **${result.mode}** — ${result.reason}.\n`
    + (result.mode === 'home-ui' ? 'Not run: portable physics, project-video pilot, immersive building, Vosk engineering and their evidence uploads. These are not reported as passed. Lint/types/unit and the complete existing smoke command remain. PR build/route boundaries remain; releases retain the Docker build gate.\n' : '')
    + 'Cheap checks are not full application acceptance.\n');
}
