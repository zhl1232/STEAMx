import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planCIChecks } from './ci-test-plan.mjs';

const testFile = path => /\.(?:test|spec)\.tsx?$/.test(path);
const localPath = path => relative(process.cwd(), path).split('\\').join('/');

// These contracts walk app/components/lib source with fs rather than importing
// the files they check, so Vite's reverse dependency graph cannot select them.
export const GLOBAL_SOURCE_CONTRACT_TESTS = [
  'lib/seo/internal-links.test.ts',
  'lib/seo/title.test.ts',
];

// A pure selection boundary lets tests prove graph uncertainty falls back
// before execution. Assertion failures never enter that fallback path.
export async function selectUnitTests(plan, allFiles, related) {
  if (plan.unitMode !== 'related' || !plan.unitSources?.length || !plan.unitOwners?.length
      || !allFiles.length) throw Error('No reliable affected unit scope');
  const files = new Set(allFiles);
  if (GLOBAL_SOURCE_CONTRACT_TESTS.some(file => !files.has(file))) {
    throw Error('A global source contract was not discovered');
  }
  const ownerTests = new Set();
  for (const roots of plan.unitOwners) {
    const owned = allFiles.filter(file => roots.some(root => file.startsWith(root)));
    if (!owned.length) throw Error('An affected owner has no test suite');
    owned.forEach(file => ownerTests.add(file));
  }
  const changedTests = plan.unitSources.filter(testFile);
  if (changedTests.some(file => !files.has(file))) throw Error('Changed test was not discovered');
  const required = [...ownerTests, ...changedTests, ...GLOBAL_SOURCE_CONTRACT_TESTS];
  const affected = await related([...new Set([...plan.unitSources, ...required])]);
  if (!Array.isArray(affected) || !affected.length || affected.some(file => !files.has(file))
      || required.some(file => !affected.includes(file))) {
    throw Error('Incomplete dependency graph selection');
  }
  return [...new Set(affected)].sort();
}

const createDefault = async () => {
  const { createVitest } = await import('vitest/node');
  return createVitest({ watch: false, run: true, passWithNoTests: false });
};
const executeDefault = files => {
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', ...files], { stdio: 'inherit' });
  return result.status ?? 1;
};

export async function runCIUnitTests(plan, { create = createDefault, execute = executeDefault, log = console.info } = {}) {
  let files = [], context;
  if (plan.unitMode === 'related') {
    try {
      context = await create();
      const all = await context.globTestSpecifications();
      const discovered = [...new Set(all.map(spec => localPath(spec.moduleId)))];
      files = await selectUnitTests(plan, discovered, async sources => {
        context.config.related = sources.map(file => resolve(file));
        return (await context.getRelevantTestSpecifications()).map(spec => localPath(spec.moduleId));
      });
      log(`Unit scope: dependency graph + owner suites + global source contracts; ${files.length}/${discovered.length} files selected`);
    } catch {
      files = [];
      log('Unit scope unavailable or incomplete; running the full suite');
    } finally {
      if (context) await context.close();
    }
  } else log('Unit scope: full suite');
  // Execute exactly once. A nonzero result is the result of this CI check,
  // never a reason to rerun tests or hide a real assertion failure.
  return execute(files);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let plan = { unitMode: 'full' };
  if (process.env.GITHUB_EVENT_NAME === 'pull_request'
      || process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main') {
    try {
      plan = await planCIChecks(process.env, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
    } catch { /* Missing metadata means full units. */ }
  }
  process.exitCode = await runCIUnitTests(plan);
}
