import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CONTENT_PATHS = [
  // Standalone manual operations do not alter the application image.
  /^\.github\/workflows\/ops-[^/]+\.ya?ml$/,
  /^deploy\/auth-phone-provider(?:\.test\.mjs|\.sh)$/,
  /^docs\//,
  /^(?:README|PROJECT_INDEX)\.md$/,
  /^public\/courses\/ldraw\//,
  /^scripts\/ldraw-models\//,
  /^scripts\/ldraw-reviews\//,
  /^scripts\/courseware\//,
];

export function classifyRelease(paths, { force = false } = {}) {
  if (force) return { deploy: true, reason: 'Explicit application release' };
  if (!paths.length) return { deploy: true, reason: 'No reliable change list; deploy conservatively' };
  const applicationPaths = paths.filter((file) => !CONTENT_PATHS.some((pattern) => pattern.test(file)));
  return applicationPaths.length
    ? { deploy: true, reason: `Application changes: ${applicationPaths.length}` }
    : { deploy: false, reason: 'Only standalone operations, course content or documentation changed' };
}

export function detectRelease(env = process.env, git = (args) => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120_000,
})) {
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch' || env.GITHUB_REF?.startsWith('refs/tags/')) {
    return classifyRelease([], { force: true });
  }
  const before = env.RELEASE_BEFORE ?? '';
  const after = env.GITHUB_SHA ?? '';
  if (![before, after].every((sha) => /^[a-f0-9]{40}$/.test(sha)) || /^0+$/.test(before)) {
    return classifyRelease([]);
  }
  try {
    // Fetch only the previous tip, rather than downloading the full repository history.
    git(['fetch', '--no-tags', '--depth=1', 'origin', before]);
    // Treat renames as delete + add: moving application code into docs must still deploy.
    const paths = git(['diff', '--no-renames', '--name-only', '-z', before, after]).split('\0').filter(Boolean);
    return classifyRelease(paths);
  } catch {
    return { deploy: true, reason: 'Change detection failed; deploy conservatively' };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = detectRelease();
  console.info(result.reason);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${result.deploy}\n`);
}
