import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTestImpact } from './ci-test-impact.mjs';
import { parseChanges } from './ci-scope.mjs';

const change = (path, oldMode = '100644', newMode = '100644') => ({ path, oldMode, newMode });
const flags = changes => {
  const { reason, ...selected } = classifyTestImpact(changes);
  assert.equal(typeof reason, 'string');
  assert.ok(reason.length > 0);
  return selected;
};
const expected = (...names) => Object.fromEntries(
  ['physics', 'projectVideo', 'building', 'voice'].map(name => [name, names.includes(name)]));
const all = expected('physics', 'projectVideo', 'building', 'voice');

test('the reviewed eleven-file support/footer change skips only specialties', () => {
  const paths = [
    'components/layout/conditional-app-shell.test.tsx',
    'components/layout/site-footer.test.tsx', 'components/layout/site-footer.tsx',
    'components/layout/user-button.test.tsx', 'components/layout/user-button.tsx',
    'docs/STORE_CHANNEL_FULFILLMENT_DECISION.md', 'docs/customer-support.md',
    'docs/design-system.md', 'docs/seo-indexing-checklist.md',
    'lib/support/feishu/config.test.ts', 'lib/support/feishu/config.ts',
  ];
  assert.equal(paths.length, 11);
  assert.deepEqual(flags(paths.map(path => change(path))), expected());
});

for (const [name, paths, selected] of [
  ['physics ownership', ['app/playground/physics-lab/page.tsx', 'app/api/physics-lab/state/route.ts',
    'hooks/physics-lab/use-state.ts', 'lib/physics-lab/state.ts',
    'public/physics-lab/navigation.mjs', 'tests/physics-lab/navigation.test.mjs'], ['physics']],
  ['project video and media ownership', ['app/project/[id]/page.tsx',
    'components/features/project/project-demo-video.tsx', 'lib/project/presentation.ts',
    'lib/project/video-url.ts', 'lib/mappers/project.ts', 'lib/mappers/types.ts',
    '__tests__/fixtures/project-video-pilot.json', 'e2e/project-video-pilot/seek-fixture.mp4'], ['projectVideo']],
  ['shared course player and LDraw dependencies', ['components/features/courses/building-3d-workspace.tsx',
    'components/features/courses/lesson-control-styles.ts', 'lib/courses/progress.ts',
    'lib/utils/ldraw-mpd.ts', 'public/courses/ldraw/3-hu-die.mpd',
    'e2e/building-outline/fixture.jsx', 'e2e/building-outline/mocks.jsx',
    'e2e/registration/link.jsx', 'e2e/registration/image.jsx'], ['building', 'voice']],
  ['voice engine and audio session ownership', ['components/features/courses/building-voice-capture.ts',
    'components/features/courses/use-building-voice-preparation.ts', 'lib/courses/building-voice-asr.ts',
    'components/features/tutor/tutor-audio-session.ts', 'components/features/tutor/use-tutor-voice.ts',
    'lib/ai/tutor/speech-task.ts', 'lib/ai/tutor/voice-access.ts',
    'public/courses/vosk/v2/assets.js', 'e2e/building-vosk/audio/clear-next.wav',
    'app/api/tutor/speech/course-control/route.ts'], ['voice']],
]) {
  test(name, () => {
    for (const path of paths) assert.deepEqual(flags([change(path)]), expected(...selected), path);
  });
}

test('independent support and store/shop routes are reviewed', () => {
  for (const path of ['app/support/page.tsx', 'app/store/page.tsx', 'app/admin/store/page.tsx',
    'app/api/store/orders/route.ts', 'app/shop/page.tsx', 'lib/support/feishu/config.ts']) {
    assert.deepEqual(flags([change(path)]), expected(), path);
  }
});

test('project author avatars and contextual store dependencies select the real project pilot', () => {
  for (const path of ['components/ui/user-avatar.tsx', 'components/ui/user-avatar.test.tsx',
    'components/store/contextual-store-products.tsx', 'lib/store/service.ts', 'lib/shop/items.ts']) {
    assert.deepEqual(flags([change(path)]), expected('projectVideo'), path);
  }
});

test('mixed owned modules union and unknown paths override that union', () => {
  const changes = [change('lib/support/feishu/config.ts'), change('lib/project/video-url.ts'),
    change('lib/physics-lab/state.ts')];
  assert.deepEqual(flags(changes), expected('projectVideo', 'physics'));
  assert.deepEqual(flags([...changes, change('components/ui/button.tsx')]), all);
  assert.deepEqual(flags([change('lib/project/video-url.ts'), change('lib/courses/progress.ts')]),
    expected('projectVideo', 'building', 'voice'));
});

test('regular additions and deletions retain ownership, including raw no-rename diff', () => {
  for (const [oldMode, newMode] of [['000000', '100644'], ['100644', '000000']]) {
    assert.deepEqual(flags([change('lib/physics-lab/new.ts', oldMode, newMode)]), expected('physics'));
    assert.deepEqual(flags([change('docs/customer-support.md', oldMode, newMode)]), expected());
  }
  const raw = ':100644 000000 abc 000 D\0lib/project/old.ts\0'
    + ':000000 100644 000 def A\0lib/physics-lab/new.ts\0';
  assert.deepEqual(flags(parseChanges(raw)), expected('projectVideo', 'physics'));
  assert.deepEqual(flags(parseChanges(raw + ':000000 100644 000 def A\0lib/unreviewed.ts\0')), all);
});

test('only explicitly reviewed prose is exempt', () => {
  for (const path of ['AGENTS.md', 'README.md', 'PROJECT_INDEX.md', 'docs/README.md', 'docs/deployment.md']) {
    assert.deepEqual(flags([change(path)]), expected());
  }
  for (const path of ['docs/new.md', 'docs/physics-lab.md', 'notes.md', 'docs/data.json',
    'docs/customer-support.md/extra.ts', 'docs/customer-support.md.bak']) {
    assert.deepEqual(flags([change(path)]), all, path);
  }
});

test('shared infrastructure, configuration, dependencies and tooling fall back fully', () => {
  for (const path of ['app/layout.tsx', 'app/globals.css', 'proxy.ts', 'components/layout/conditional-app-shell.tsx',
    'components/ui/button.tsx', 'components/ui/avatar.tsx', 'lib/utils/asset-url.ts',
    'lib/assets/signed-asset-url.ts', 'lib/context/auth-context.tsx', 'next.config.mjs',
    'playwright.building-vosk.config.ts', 'package.json', 'pnpm-lock.yaml', 'vitest.config.ts',
    '.github/workflows/ci.yml', 'scripts/ci-test-impact.mjs', 'scripts/prepare-building-vosk.py',
    'lib/support/package.json', 'lib/project/tsconfig.json', 'lib/store/vite.config.ts']) {
    assert.deepEqual(flags([change(path)]), all, path);
  }
});

test('missing, malformed and empty records fall back fully without throwing', () => {
  for (const input of [undefined, null, {}, '', [], [null], [{}], [change('')],
    [{ path: 'README.md' }], [change('README.md', '000000', '000000')],
    Array(1), [change('README.md'), undefined]]) {
    assert.deepEqual(flags(input), all);
  }
});

test('path tricks and unexpected modes never bypass the fallback', () => {
  for (const path of ['/lib/support/file.ts', './lib/support/file.ts', 'lib/support/../shared.ts',
    'lib/support//file.ts', 'lib/support/./file.ts', 'lib/support/file.ts\n',
    'lib/support/file\0.ts', 'lib/support\\file.ts', 'lib/support/',
    'lib/supportive/file.ts', 'lib/physics-lab-evil/file.ts']) {
    assert.deepEqual(flags([change(path)]), all, JSON.stringify(path));
  }
  for (const mode of ['120000', '100755', '160000', '100664', '', null, 100644]) {
    for (const path of ['docs/customer-support.md', 'lib/support/feishu/config.ts', 'lib/physics-lab/state.ts']) {
      assert.deepEqual(flags([change(path, mode, '100644')]), all);
      assert.deepEqual(flags([change(path, '100644', mode)]), all);
    }
  }
});
