import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DOC_PATHS, parseChanges } from './ci-scope.mjs';
import { classifyTestImpact, verifiedStoreMigrations } from './ci-test-impact.mjs';

import { HOME_PATHS } from './home-ui-scope.mjs';
import { classifyHomeChanges } from './ci-scope.mjs';
export { HOME_PATHS };

const full = (reason) => ({ mode: 'full', reason });
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && !/^0+$/.test(value);
const gitDefault = (args) => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000,
});

export function classifyVoiceChanges(changes, verifiedMigrations = new Set()) {
  if (!changes.length) return full('Empty comparison');
  const safe = changes.every(({ path, oldMode, newMode }) =>
    DOC_PATHS.has(path)
      ? ['000000', '100644'].includes(oldMode) && ['000000', '100644'].includes(newMode)
      // No new/deleted/renamed components or executable/symlink changes.
      : HOME_PATHS.has(path) && oldMode === '100644' && newMode === '100644');
  if (safe) return { mode: 'headers', reason: 'Only reviewed homepage presentation or prose changed' };
  return !classifyTestImpact(changes, verifiedMigrations).voice
    ? { mode: 'headers', reason: 'Reviewed module changes do not affect the voice runtime' }
    : full('Shared, voice, configuration or unknown changes');
}

export async function detectVoiceScope(env = process.env, git = gitDefault, request = fetch) {
  if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF !== 'refs/heads/main') {
    return full('Tags, manual releases and unknown events require full voice validation');
  }
  const before = env.RELEASE_BEFORE, after = env.GITHUB_SHA;
  if (!sha(before) || !sha(after) || before === after) return full('Missing reliable comparison range');
  try {
    if (git(['rev-parse', 'HEAD']).trim() !== after) throw Error('Checkout SHA mismatch');
    git(['fetch', '--no-tags', '--depth=1', 'origin', before]);
    const changes = parseChanges(git([
      'diff', '--raw', '--no-renames', '--no-ext-diff', '-z', before, after, '--',
    ]));
    const verifiedMigrations = verifiedStoreMigrations(changes, path => git(['show', `${after}:${path}`]));
    const selection = classifyVoiceChanges(changes, verifiedMigrations);
    if (selection.mode === 'full') return selection;
    const home = changes.some(change => HOME_PATHS.has(change.path));
    if (home && classifyHomeChanges(changes, before, after, git).mode !== 'home-ui') {
      return full('Homepage dependency inspection did not qualify');
    }
    // Compare only against a known successful release, not merely the previous push.
    // This is a scope baseline, never a replacement for this SHA's CI/build/deploy.
    if (!env.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? '')) {
      throw Error('No baseline lookup credentials');
    }
    const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/release.yml/runs?per_page=10`;
    const response = await request(url, { headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw Error('Baseline API unavailable');
    const { workflow_runs: runs } = await response.json();
    if (!Array.isArray(runs) || !env.GITHUB_RUN_ID) throw Error('Invalid run history');
    const previous = runs.find(run => String(run.id) !== env.GITHUB_RUN_ID);
    if (!previous || previous.head_sha !== before || previous.path !== '.github/workflows/release.yml'
      || previous.event !== 'push' || previous.head_branch !== 'main'
      || previous.status !== 'completed' || previous.conclusion !== 'success') {
      throw Error('Latest preceding release is not a successful comparison base');
    }
    // A content-only run can be green with deployment skipped. Such a tip is
    // not a deployed baseline: pending course assets could otherwise disappear
    // from before..after while entering the next image.
    if (!Number.isSafeInteger(previous.id) || previous.id < 1) throw Error('Invalid baseline run');
    const jobsResponse = await request(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/runs/${previous.id}/jobs?filter=latest&per_page=100`, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' }, redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!jobsResponse.ok) throw Error('Baseline jobs unavailable');
    const jobData = await jobsResponse.json();
    if (!Array.isArray(jobData.jobs) || jobData.total_count !== jobData.jobs.length
      || !['ci / test-and-lint', 'build-image', 'deploy-production', 'verify-course-voice-loading']
        .every(name => jobData.jobs.some(job => job.name === name
          && job.status === 'completed' && job.conclusion === 'success'))) {
      throw Error('Baseline did not complete CI, image, deployment and voice validation');
    }
    return { ...selection, ciProfile: home ? 'home-ui' : 'full', before, verifiedSha: after };
  } catch {
    // A previous push can contain voice changes that never reached production
    // or passed validation. Its diff cannot justify skipping the full probe.
    return full('Comparison or successful-release baseline unavailable');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await detectVoiceScope();
  console.log(`Release voice scope: ${result.mode} — ${result.reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mode=${result.mode}\nci-profile=${result.ciProfile ?? 'full'}\nbefore=${result.before ?? ''}\nverified-sha=${result.verifiedSha ?? ''}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `Voice validation: **${result.mode}** — ${result.reason}. Header failure falls back to the full probe.\n`);
}
