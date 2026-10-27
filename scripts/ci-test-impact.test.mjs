import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTestImpact, classifyCoreTestImpact, verifiedStoreMigrations } from './ci-test-impact.mjs';
import { readFileSync } from 'node:fs';
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

test('isolated module modifications narrow units and unrelated browser details', () => {
  const selected = classifyCoreTestImpact([change('components/support/support-chat.tsx')]);
  assert.equal(selected.unitMode, 'related');
  assert.deepEqual(selected.unitSources, ['components/support/support-chat.tsx']);
  assert.ok(selected.unitOwners[0].includes('lib/support/'));
  for (const key of ['smokeHome', 'smokePlayground', 'smokeNature', 'guides', 'assets']) {
    assert.equal(selected[key], false, key);
  }
  const store = classifyCoreTestImpact([change('components/store/store-checkout.tsx')]);
  assert.equal(store.unitMode, 'related');
  assert.equal(store.smokeHome, true);
  assert.equal(store.smokePlayground, false);
  const mixed = classifyCoreTestImpact([change('lib/support/server.ts'), change('lib/store/service.ts')]);
  assert.equal(mixed.unitOwners.length, 2);
  assert.equal(mixed.smokeHome, true);
  const project = classifyCoreTestImpact([change('lib/project/science-samples.ts')]);
  assert.equal(project.guides, true, 'learning guides consume project science samples');
  assert.equal(project.smokeHome, true);
  assert.equal(project.smokePlayground, false);
});

test('shared, unknown, config, runtime data and add/delete/rename changes retain full core scope', () => {
  for (const changes of [undefined, [], [null],
    ...['components/layout/site-footer.tsx', 'components/layout/user-button.tsx', 'components/ui/user-avatar.tsx',
      'lib/support/data.json', 'lib/new-module.ts', 'package.json',
      'e2e/smoke.spec.ts', 'vitest.setup.ts'].map(path => [change(path)]),
    [change('lib/support/server.ts', '000000', '100644')],
    [change('lib/support/server.ts', '100644', '000000')],
    [change('lib/support/server.ts', '100644', '120000')],
    [change('lib/support/old.ts', '100644', '000000'), change('lib/support/new.ts', '000000', '100644')],
    [change('lib/support/server.ts'), change('app/globals.css')]]) {
    const selected = classifyCoreTestImpact(changes);
    assert.equal(selected.unitMode, 'full');
    for (const key of ['smokeHome', 'smokePlayground', 'smokeNature', 'guides', 'assets']) assert.equal(selected[key], true);
  }
});

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
    'scripts/prepare-building-vosk.py'], ['voice']],
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

test('mixed module ownership unions only affected browser dependencies', () => {
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
  assert.deepEqual(flags(parseChanges(raw + ':000000 100644 000 def A\0lib/unreviewed.ts\0')), expected('projectVideo', 'physics'));
});

test('only explicitly reviewed prose is exempt', () => {
  for (const path of ['AGENTS.md', 'README.md', 'PROJECT_INDEX.md', 'docs/README.md', 'docs/deployment.md']) {
    assert.deepEqual(flags([change(path)]), expected());
  }
  for (const path of ['docs/new.md', 'docs/physics-lab.md', 'notes.md', 'docs/data.json',
    'docs/customer-support.md/extra.ts', 'docs/customer-support.md.bak']) {
    assert.deepEqual(flags([change(path)]), expected(), path);
  }
});

test('shared infrastructure, configuration, dependencies and tooling fall back fully', () => {
  for (const path of ['app/globals.css', 'app/styles/globals-motion.css',
    'components/ui/button.tsx', 'components/ui/avatar.tsx', 'lib/utils.ts', 'lib/utils/asset-url.ts',
    'lib/assets/signed-asset-url.ts', 'next.config.mjs',
    'package.json', 'pnpm-lock.yaml', 'vitest.config.ts',
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
    'lib/support/../shared.ts']) {
    assert.deepEqual(flags([change(path)]), all, JSON.stringify(path));
  }
  for (const mode of ['120000', '160000', '100664', '', null, 100644]) {
    for (const path of ['docs/customer-support.md', 'lib/support/feishu/config.ts', 'lib/physics-lab/state.ts']) {
      assert.deepEqual(flags([change(path, mode, '100644')]), all);
      assert.deepEqual(flags([change(path, '100644', mode)]), all);
    }
  }
});

test('payment adapters do not launch the project video or course fixtures', () => {
  for (const path of ['lib/store/payments/alipay.ts', 'lib/store/payments/alipay.test.ts',
    'lib/store/payments/wechat.ts']) assert.deepEqual(flags([change(path)]), expected());
  assert.deepEqual(flags([change('lib/store/service.ts')]), expected('projectVideo'));
});

test('the executable commerce database test has explicit ownership without exempting executable modes globally', () => {
  const script = change('scripts/test-store-native.mjs', '100755', '100755');
  assert.deepEqual(flags([script]), expected());
  const plan = classifyCoreTestImpact([script]);
  assert.equal(plan.unitMode, 'related');
  assert.equal(plan.storeDb, true);
  assert.deepEqual(plan.unitSources, ['lib/store/native.ts']);
  for (const altered of [change(script.path, '100644', '100755'),
    change(script.path, '000000', '100755'), change(script.path, '100755', '000000'),
    change('scripts/unknown.mjs', '100755', '100755')]) {
    assert.deepEqual(flags([altered]), expected());
    assert.equal(classifyCoreTestImpact([altered]).unitMode, 'full');
  }
});

test('only exact reviewed SQL content qualifies for commerce ownership', () => {
  const path = 'supabase/migrations/20261027003000_store_payment_crypto_schema.sql';
  const changes = [change(path, '000000', '100644')];
  const verified = verifiedStoreMigrations(changes, name => readFileSync(name));
  assert.deepEqual([...verified], [path]);
  const { reason, ...selected } = classifyTestImpact(changes, verified);
  assert.deepEqual(selected, expected());
  assert.equal(classifyCoreTestImpact(changes, verified).storeDb, true);
  assert.equal(classifyCoreTestImpact(changes, verified).unitMode, 'related');
  for (const read of [() => readFileSync(path, 'utf8') + '\nSELECT 1;',
    () => { throw Error('Unavailable SQL'); }]) {
    const rejected = verifiedStoreMigrations(changes, read);
    assert.deepEqual([...rejected], []);
    assert.deepEqual(classifyTestImpact(changes, rejected), classifyTestImpact(changes));
    assert.equal(classifyCoreTestImpact(changes, rejected).unitMode, 'full');
  }
  assert.deepEqual([...verifiedStoreMigrations([change(path, '100644', '000000')],
    () => readFileSync(path))], []);
  assert.deepEqual(flags([change('supabase/migrations/20990101000000_store_unknown.sql', '000000')]), expected());
});

test('unrelated scripts, workflow policy, docs and SQL never imply a changed browser feature', () => {
  for (const path of ['.github/workflows/ci.yml', 'scripts/ci-test-impact.mjs',
    'scripts/unrelated.mjs',
    'supabase/migrations/20990101000000_unknown.sql', 'docs/physics-lab.md',
    'lib/unreviewed.ts', 'lib/supportive/file.ts', 'lib/physics-lab-evil/file.ts']) {
    assert.deepEqual(flags([change(path)]), expected(), path);
    assert.equal(classifyCoreTestImpact([change(path)]).unitMode, 'full', path);
  }
});

test('regular executable scripts are valid paths, not evidence of changed browser dependencies', () => {
  for (const [oldMode, newMode] of [['100755', '100755'], ['000000', '100755'],
    ['100755', '000000'], ['100644', '100755']]) {
    assert.deepEqual(flags([change('scripts/unrelated.mjs', oldMode, newMode)]), expected());
    assert.equal(classifyCoreTestImpact([change('scripts/unrelated.mjs', oldMode, newMode)]).unitMode, 'full');
  }
});

test('fixture dependency ownership excludes mocked Next shell and unrelated configs', () => {
  for (const path of ['app/layout.tsx', 'proxy.ts', 'components/layout/conditional-app-shell.tsx',
    'components/layout/theme-provider.tsx', 'components/layout/error-boundary.tsx',
    'components/pwa/service-worker-register.tsx', 'components/navigation/return-href.tsx',
    'lib/brand.ts', 'lib/seo/site.ts', 'lib/seo/title.ts', 'public/sw.js',
    'lib/context/auth-context.tsx', 'lib/auth.ts', 'lib/supabase/client.ts',
    'lib/seo/metadata.ts', 'lib/fonts.ts', 'components/providers/query-provider.tsx', 'e2e/visit-prompt.ts']) {
    assert.deepEqual(flags([change(path)]), expected('physics', 'projectVideo'), path);
  }
  assert.deepEqual(flags([change('lib/works/capability.ts')]), expected('building', 'voice'));
  assert.deepEqual(flags([change('playwright.project-video-pilot.config.ts')]), expected('projectVideo'));
  assert.deepEqual(flags([change('playwright.building-outline.config.ts')]), expected('building'));
  assert.deepEqual(flags([change('playwright.building-vosk.config.ts')]), expected('voice'));
  assert.deepEqual(flags([change('playwright.config.ts')]), expected('physics'));
  assert.deepEqual(flags([change('app/api/tutor/speech/course-control/route.ts')]), expected());
});

test('full unit fallback never adds an unrelated commerce database suite', () => {
  for (const path of ['docs/new.md', 'scripts/unrelated.mjs', 'scripts/ci-test-impact.mjs',
    'lib/physics-lab/state.ts', 'lib/courses/progress.ts', 'components/ui/button.tsx',
    'app/layout.tsx', '.github/workflows/ci.yml']) {
    const plan = classifyCoreTestImpact([change(path)]);
    assert.equal(plan.unitMode, 'full', path);
    assert.equal(plan.storeDb, false, path);
  }
  for (const path of ['supabase/migrations/20990101000000_unknown.sql',
    'scripts/db-push.mjs', 'lib/supabase/types.ts', 'lib/membership.ts',
    'lib/auth/session.ts', 'lib/gamification/coins.ts', 'lib/shop/items.ts',
    'package.json', 'pnpm-lock.yaml']) {
    assert.equal(classifyCoreTestImpact([change(path)]).storeDb, true, path);
  }
  assert.equal(classifyCoreTestImpact([null]).storeDb, true);
});

test('project route data and contextual storefront imports select video, checkout internals do not', () => {
  for (const path of ['lib/api/explore-data.ts', 'lib/api/courses.ts', 'lib/api/validation.ts',
    'lib/explore/project-navigation-context.ts', 'lib/explore/material-matching.ts',
    'lib/explore/household-materials.data.json', 'components/features/project-interactions.tsx',
    'components/features/social/follow-button.tsx', 'hooks/use-follow.ts',
    'lib/store/service.ts', 'lib/store/config.ts', 'lib/store/address-crypto.ts',
    'lib/store/external-channel.ts', 'components/store/contextual-store-products.tsx']) {
    assert.deepEqual(flags([change(path)]), expected('projectVideo'), path);
    if (/\.tsx?$/.test(path)) {
      const testPath = path.replace(/\.(tsx?)$/, '.test.$1');
      assert.deepEqual(flags([change(testPath)]), expected('projectVideo'), testPath);
    }
  }
  for (const path of ['components/store/store-checkout.tsx', 'lib/store/native.ts',
    'lib/store/payment-flow.ts', 'lib/store/payments/alipay.ts']) {
    assert.deepEqual(flags([change(path)]), expected(), path);
  }
});
