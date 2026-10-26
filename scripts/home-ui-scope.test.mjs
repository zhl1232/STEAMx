import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { HOME_PATHS, hasReviewedDependencies } from './home-ui-scope.mjs';
import { classifyHomeChanges, detectScope, detectReleaseCI } from './ci-scope.mjs';
import { detectVoiceScope } from './release-voice-scope.mjs';
const before = 'a'.repeat(40), head = 'b'.repeat(40), after = 'c'.repeat(40);
const sources = new Map([...HOME_PATHS].map(path => [path, readFileSync(path, 'utf8')]));
const home = [...HOME_PATHS][0];
const change = (path = home, oldMode = '100644', newMode = '100644') => ({ path, oldMode, newMode });
const raw = changes => changes.map(c => `:${c.oldMode} ${c.newMode} abc def M\0${c.path}\0`).join('');
function git(changes = [change()], mutate = source => source) {
  return args => {
    if (args[0] === 'rev-parse') return after;
    if (args[0] === 'fetch') return '';
    if (args[0] === 'diff') {
      assert(args.includes('--no-renames') && args.includes('-z'));
      assert(args.includes(before) && args.includes(after));
      return raw(changes);
    }
    if (args[0] === 'show' && args[1] === '-s') return `${before} ${head}`;
    if (args[0] === 'show') {
      const [ref, path] = args[1].split(':');
      return ref === after ? mutate(sources.get(path)) : sources.get(path);
    }
    throw Error('unexpected command');
  };
}
const prEnv = { GITHUB_EVENT_NAME: 'pull_request', GITHUB_SHA: after };
const event = action => ({ action, pull_request: { draft: false, base: { sha: before }, head: { sha: head } } });
const releaseEnv = { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: after,
  CI_PROFILE: 'home-ui', CI_BEFORE: before, CI_VERIFIED_SHA: after };

test('reviewed sources with display-only edits qualify for PR and release profiles', () => {
  for (const [path, source] of sources) {
    assert(hasReviewedDependencies(path, source), path);
    const changes = [change(path), change('README.md')];
    for (const action of ['opened', 'synchronize', 'reopened', 'ready_for_review']) {
      assert.equal(detectScope(prEnv, event(action), git(changes, s => s.replace('首页', '主页'))).mode, 'home-ui');
    }
    assert.equal(detectReleaseCI(releaseEnv, git(changes)).mode, 'home-ui');
  }
});
test('changed/new/re-exported/dynamic imports or loaders force full', () => {
  const edits = [
    s => s.replace('next/image', 'other/image'),
    s => `import New from 'new-dependency';\n${s}`,
    s => `${s}\nimport X from 'new-dependency';`,
    s => `${s}\nexport { X } from 'new-dependency';`,
    s => `${s}\nexport type { VoiceThing } from '@/lib/courses/building-voice';`,
    s => s.replace('<section', '<script type="module" src="https://example.invalid/voice.js" /><section'),
    s => s.replace('<section', '<iframe src="https://example.invalid" /><section'),
    s => `${s}\nconst changedProgramLogic = 1;`,
    s => `${s}\nconst load = () => import('new-dependency');`,
    s => `${s}\nconst load = () => import /* comment */ ('new-dependency');`,
    s => `${s}\nconst load = require('new-dependency');`,
    s => `${s}\nnew Worker('new-worker');`,
    s => `${s}\nfetch('/new-api');`,
    s => `${s}\nconst escaped = '\\u0069mport';`,
    s => `${s}\ndocument.createElement('script');`,
  ];
  for (const edit of edits) {
    assert.equal(detectScope(prEnv, event('ready_for_review'), git([change()], edit)).mode, 'full');
    assert.equal(detectReleaseCI(releaseEnv, git([change()], edit)).mode, 'full');
  }
});
test('unreviewed dependencies at both endpoints cannot qualify by merely being unchanged', () => {
  const run = git();
  const changedBoth = args => args[0] === 'show' && args[1] !== '-s'
    ? run(args).replace('next/image', 'other/image') : run(args);
  assert.equal(detectScope(prEnv, event('opened'), changedBoth).mode, 'full');
});
test('only modifications of ordinary known files qualify; mixed/shared paths are full', () => {
  for (const path of ['app/page.tsx', 'app/layout.tsx', 'components/ui/button.tsx', 'app/globals.css',
    'lib/utils.ts', 'lib/brand.ts', 'next.config.mjs', 'pnpm-lock.yaml', 'supabase/migrations/a.sql',
    'lib/auth.ts', '.github/workflows/ci.yml', 'deploy/nginx.conf', 'components/home/new.tsx']) {
    assert.equal(classifyHomeChanges([change(), change(path)], before, after, git()).mode, 'full', path);
  }
  for (const [old, next] of [['000000', '100644'], ['100644', '000000'], ['100644', '120000'], ['100755', '100644']]) {
    assert.equal(classifyHomeChanges([change(home, old, next)], before, after, git()).mode, 'full');
  }
  assert.equal(classifyHomeChanges([change(home, '100644', '000000'), change('docs/renamed.md', '000000')], before, after, git()).mode, 'full');
  assert.equal(classifyHomeChanges([change()], before, after, () => { throw Error('missing blob'); }).mode, 'full');
});
test('release caller profile requires correct event, ref, comparison and verified SHA', () => {
  for (const overrides of [{ CI_PROFILE: '' }, { CI_PROFILE: 'full' }, { CI_VERIFIED_SHA: before },
    { CI_BEFORE: '' }, { CI_BEFORE: '0'.repeat(40) }, { CI_BEFORE: after },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/tags/v1' }]) {
    assert.equal(detectReleaseCI({ ...releaseEnv, ...overrides }, git()).mode, 'full');
  }
  assert.equal(detectReleaseCI(releaseEnv, () => { throw Error('comparison missing'); }).mode, 'full');
  assert.equal(detectReleaseCI(releaseEnv, git([])).mode, 'full');
});
test('release scope will not emit an optimized CI profile for newly imported dependencies', async () => {
  const env = { ...releaseEnv, RELEASE_BEFORE: before, GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '2' };
  const result = await detectVoiceScope(env, git([change()], s => `${s}\nimport X from 'new';`), () => { throw Error('must not need API'); });
  assert.equal(result.mode, 'full');
  assert.equal(result.ciProfile, undefined);
});

test('fingerprint permits literal copy/style edits but rejects markup, links and logic changes', () => {
  const source = sources.get(home);
  assert(hasReviewedDependencies(home, source.replace('陪孩子，一起动手做', '一起探索新发现')));
  assert(hasReviewedDependencies(home, source.replace('className="surface-card relative overflow-hidden rounded-sm"', 'className="surface-card relative overflow-hidden rounded-lg"')));
  assert.equal(hasReviewedDependencies(home, source.replace('width={1672}', 'width={1200}')), false);
  assert.equal(hasReviewedDependencies(home, source.replace('href="/leaderboard"', 'href="/new-route"')), false);
  assert.equal(hasReviewedDependencies(home, source.replace('<section', '<div')), false);
});
