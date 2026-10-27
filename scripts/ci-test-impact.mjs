import { createHash } from 'node:crypto';

// Specialty selection only. Lint, types, unit, core smoke and security checks
// remain the caller's responsibility, including when every flag is false.
const specialties = ['physics', 'projectVideo', 'building', 'voice'];
const result = (enabled, reason) => ({
  ...Object.fromEntries(specialties.map(name => [name, enabled.includes(name)])), reason,
});
const full = reason => result(specialties, reason);

// Reviewed prose, not a Markdown/docs wildcard. This does not expand the
// dependency-fingerprinted home-ui or deployment documentation allowlists.
const prose = new Set([
  'AGENTS.md', 'README.md', 'PROJECT_INDEX.md', 'docs/README.md', 'docs/deployment.md',
  'docs/customer-support.md', 'docs/STORE_CHANNEL_FULFILLMENT_DECISION.md',
  'docs/design-system.md', 'docs/seo-indexing-checklist.md',
]);
// Exact reviewed SQL content, never a filename-pattern exemption. Any edit or
// unknown migration keeps the full fallback until its dependencies are reviewed.
const storeMigrations = new Map([
  ['supabase/migrations/20261027003000_store_payment_crypto_schema.sql',
    'b614e0630ed700539c59194efbfdc68e76ded3ad015a2763efc832de68594d07'],
]);
export function verifiedStoreMigrations(changes, readContent) {
  const verified = new Set();
  for (const change of changes ?? []) {
    if (!storeMigrations.has(change?.path) || change.newMode !== '100644'
        || !['000000', '100644'].includes(change.oldMode)) continue;
    try {
      const content = readContent(change.path);
      if (createHash('sha256').update(content).digest('hex') === storeMigrations.get(change.path)) {
        verified.add(change.path);
      }
    } catch { /* Missing content must not narrow the plan. */ }
  }
  return verified;
}
// The project route compiles these direct and transitive runtime dependencies.
// Other checkout/payment files are not dependencies of the video fixture.
const projectRuntimeFiles = new Set([
  'components/store/contextual-store-products.tsx',
  'lib/store/service.ts', 'lib/store/config.ts', 'lib/store/address-crypto.ts',
  'lib/store/external-channel.ts', 'lib/api/explore-data.ts', 'lib/api/courses.ts',
  'lib/api/validation.ts', 'components/features/project-interactions.tsx',
  'components/features/social/follow-button.tsx', 'components/icons/coin-icon.tsx',
  'components/seo/json-ld.tsx', 'lib/config/categories.ts', 'lib/textbook3d/registry.ts',
  'components/features/textbook3d/textbook-frame.tsx', 'hooks/use-follow.ts',
  'hooks/use-login-continuation.ts', 'lib/logger.ts', 'lib/testing/playwright-smoke.ts',
]);
const runtimeSource = path => path.replace(/\.test(?=\.tsx?$)/, '');

const storeTestScript = 'scripts/test-store-native.mjs';
const storeRoots = ['app/store/', 'app/admin/store/', 'app/api/store/', 'app/api/admin/store/',
  'components/store/', 'lib/store/'];
const storeScriptChange = change => change?.path === storeTestScript
  && change.oldMode === '100755' && change.newMode === '100755';
const verifiedMigrationChange = (change, verified) => verified.has(change?.path)
  && change.newMode === '100644' && ['000000', '100644'].includes(change.oldMode);

const unrelatedFiles = new Set([
  'components/layout/site-footer.tsx', 'components/layout/site-footer.test.tsx',
  'components/layout/user-button.tsx', 'components/layout/user-button.test.tsx',
  // Only this test's footer labels were reviewed; the app shell stays shared.
  'components/layout/conditional-app-shell.test.tsx',
]);
const unrelatedDirectories = [
  'app/support/', 'app/store/', 'app/shop/', 'app/coins/',
  'app/admin/support/', 'app/admin/store/', 'app/api/support/',
  'app/api/store/', 'app/api/shop/', 'app/api/admin/support/', 'app/api/admin/store/',
  'components/support/', 'components/shop/', 'lib/support/', 'app/api/tutor/speech/',
];

// Direct root-layout imports run in the real Next fixtures, not the isolated
// building/voice fixtures. Keep this before project-only import ownership.
const nextShellFiles = new Set([
  'components/layout/theme-provider.tsx', 'components/layout/error-boundary.tsx',
  'components/features/gamification/observation-gamification-sync.tsx',
  'components/features/gamification/badge-unlock-overlay-mount.tsx',
  'components/pwa/install-prompt.tsx', 'components/pwa/service-worker-register.tsx',
  'components/navigation/return-href.tsx', 'public/sw.js',
  'lib/brand.ts', 'lib/seo/site.ts', 'lib/seo/site-verification.ts', 'lib/seo/title.ts',
]);

// Directory ownership is explicit; only identified shared browser dependencies
// select all fixtures. The fixtures import building UI and LDraw
// in both outline and Vosk, and share registration's link/image and outline mocks.
const rules = [
  // Next routes use the real shell/auth; isolated building and voice fixtures mock them.
  { directories: ['lib/context/', 'lib/auth/', 'lib/supabase/', 'lib/access/'],
    files: ['app/layout.tsx', 'app/providers.tsx', 'proxy.ts',
      'components/layout/conditional-app-shell.tsx', 'lib/auth.ts',
      'lib/seo/metadata.ts', 'lib/brand.ts', 'lib/fonts.ts',
      'components/providers/query-provider.tsx', 'e2e/visit-prompt.ts'], enabled: ['physics', 'projectVideo'] },
  { directories: [], files: ['lib/works/capability.ts'], enabled: ['building', 'voice'] },
  { directories: ['app/playground/physics-lab/', 'app/api/physics-lab/',
    'hooks/physics-lab/', 'lib/physics-lab/', 'public/physics-lab/', 'tests/physics-lab/'],
    files: ['e2e/physics-lab.spec.ts'], enabled: ['physics'] },
  { directories: ['app/project/', 'components/features/project/', 'lib/project/',
    'lib/mappers/', 'lib/explore/', 'lib/recommendations/', 'lib/content-classification/',
    'lib/seo/', 'e2e/project-video-pilot/', 'lib/shop/'],
    // The real project page renders author avatars and contextual store content.
    files: ['__tests__/fixtures/project-video-pilot.json', 'components/ui/user-avatar.tsx',
      'components/ui/user-avatar.test.tsx'], enabled: ['projectVideo'] },
  { directories: ['public/courses/vosk/', 'e2e/building-vosk/', 'e2e/building-kws/',
    ], files: ['scripts/prepare-building-vosk.py'], enabled: ['voice'] },
  { directories: ['app/courses/', 'app/api/courses/', 'components/features/courses/',
    'components/features/ldraw/', 'lib/courses/', 'public/courses/ldraw/',
    'e2e/building-outline/'],
    files: ['e2e/registration/link.jsx', 'e2e/registration/image.jsx'],
    enabled: ['building', 'voice'] },
];

const ownedFile = (path, directory, stems) => {
  if (!path.startsWith(directory)) return false;
  const file = path.slice(directory.length);
  return !file.includes('/') && stems.some(stem => file.startsWith(stem));
};
const inDirectories = (path, directories) => directories.some(directory => path.startsWith(directory));
const validPath = path => typeof path === 'string' && path.length > 0
  // Git path records containing whitespace or control bytes cannot narrow CI.
  // eslint-disable-next-line no-control-regex
  && !/[\x00-\x20\x7f\\]/.test(path)
  && path.split('/').every(segment => segment && segment !== '.' && segment !== '..');
// Only runtime dependencies shared by the browser fixtures select all of them.
// Unrelated scripts, SQL and prose still retain core checks, not browser fixtures.
const sharedRuntimeFiles = new Set(['app/globals.css', 'lib/utils.ts', 'vitest.setup.ts']);
const sharedRuntimeRoots = ['app/styles/', 'components/home/', 'components/ui/', 'lib/utils/', 'lib/assets/'];
const specialtyConfigurations = new Map([
  ['playwright.project-video-pilot.config.ts', ['projectVideo']],
  ['playwright.building-outline.config.ts', ['building']],
  ['playwright.building-vosk.config.ts', ['voice']],
  ['playwright.building-kws.config.ts', ['voice']],
  ['playwright.config.ts', ['physics']],
]);
const isSharedConfiguration = path => {
  const basename = path.split('/').at(-1);
  return /^(?:package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|tsconfig(?:\..+)?\.json)$/.test(basename)
    || /(?:^|\.)config\.(?:[cm]?[jt]s|json)$/.test(basename) && path !== 'lib/support/feishu/config.ts';
};

export function classifyTestImpact(changes, verified = new Set()) {
  if (!Array.isArray(changes) || !changes.length) return full('Missing or empty change records');
  const enabled = new Set();
  for (const change of changes) {
    if (storeScriptChange(change) || verifiedMigrationChange(change, verified)) continue;
    if (!change || !validPath(change.path)
        || !['000000', '100644', '100755'].includes(change.oldMode)
        || !['000000', '100644', '100755'].includes(change.newMode)
        || (change.oldMode === '000000' && change.newMode === '000000')) {
      return full('Invalid path, missing record or unexpected file modes');
    }
    const path = change.path;
    if (nextShellFiles.has(runtimeSource(path))) {
      enabled.add('physics'); enabled.add('projectVideo');
      continue;
    }
    if (projectRuntimeFiles.has(runtimeSource(path))) {
      enabled.add('projectVideo');
      continue;
    }
    if (specialtyConfigurations.has(path)) {
      specialtyConfigurations.get(path).forEach(name => enabled.add(name));
      continue;
    }
    // General dependency/build configuration is shared; fixture configs above
    // belong only to their actual consumer.
    if (isSharedConfiguration(path)) {
      return full('Dependency or tool configuration changed');
    }
    if (prose.has(path) || unrelatedFiles.has(path) || inDirectories(path, unrelatedDirectories)
        || path.startsWith('lib/store/payments/')) continue;
    // Voice capture/preparation and tutor session ownership are independent of
    // the 3D renderer. Other course files are shared by both fixture trees.
    if (ownedFile(path, 'components/features/courses/', ['building-voice-', 'use-building-voice-'])
        || ownedFile(path, 'lib/courses/', ['building-voice-'])
        || ownedFile(path, 'components/features/tutor/', ['tutor-audio-', 'tutor-voice', 'use-tutor-voice'])
        || ownedFile(path, 'lib/ai/tutor/', ['speech', 'voice-'])) {
      enabled.add('voice');
      continue;
    }
    if (ownedFile(path, 'lib/utils/', ['ldraw-'])) {
      enabled.add('building'); enabled.add('voice');
      continue;
    }
    const rule = rules.find(rule => rule.files.includes(path) || inDirectories(path, rule.directories));
    if (rule) {
      for (const name of rule.enabled) enabled.add(name);
    } else if (sharedRuntimeFiles.has(path) || inDirectories(path, sharedRuntimeRoots)) {
      return full('Shared browser runtime changed');
    }
    // A valid unrelated/unknown path is not evidence that a completed browser
    // feature changed. Core and database guards handle unclassified changes.
  }
  return result([...enabled], enabled.size
    ? `Reviewed module ownership selects: ${[...enabled].join(', ')}`
    : 'No affected browser specialty dependencies; specialties not run');
}

export const fullCoreTestImpact = () => ({
  unitMode: 'full', unitSources: [], unitOwners: [], storeDb: true,
  smokeHome: true, smokePlayground: true, smokeNature: true, guides: true, assets: true,
});

// Unit graph narrowing is intentionally smaller than specialty ownership.
// These owner suites also cover same-module runtime reads that Vite cannot see.
const coreOwners = [
  { roots: ['app/support/', 'app/admin/support/', 'app/api/support/', 'app/api/admin/support/',
    'components/support/', 'lib/support/'], browser: [],
    tests: ['app/support/', 'app/admin/support/', 'app/api/support/', 'app/api/admin/support/',
      'components/support/', 'lib/support/'] },
  { roots: storeRoots, browser: ['smokeHome'], tests: storeRoots, storeDb: true },
  { roots: ['app/shop/', 'app/coins/', 'app/api/shop/', 'components/shop/', 'lib/shop/'],
    browser: ['smokeHome'], tests: ['app/shop/', 'app/coins/', 'app/api/shop/', 'components/shop/', 'lib/shop/'] },
  { roots: ['app/project/', 'components/features/project/', 'lib/project/'],
    // Learning guides consume lib/project/science-samples.ts outside imports
    // represented by the standalone browser suite's dependency graph.
    browser: ['smokeHome', 'guides'], tests: ['app/project/', 'components/features/project/', 'lib/project/'] },
];

// A full unit/browser fallback is not evidence that commerce changed. Keep the
// real database suite tied to commerce, migrations and its shared schema inputs.
function storeDatabaseImpact(changes) {
  if (!Array.isArray(changes) || !changes.length) return true;
  return changes.some(change => {
    if (!change || !validPath(change.path)
        || !['000000', '100644', '100755'].includes(change.oldMode)
        || !['000000', '100644', '100755'].includes(change.newMode)
        || change.oldMode === '000000' && change.newMode === '000000') return true;
    const path = change.path;
    return inDirectories(path, [...storeRoots, 'supabase/migrations/', 'lib/supabase/',
      'lib/auth/', 'lib/gamification/', 'lib/shop/', 'app/shop/', 'app/coins/',
      'app/api/shop/', 'app/api/coins/'])
      || ['lib/membership.ts', 'lib/auth.ts', 'scripts/db-push.mjs',
        'scripts/db-push.test.mjs', storeTestScript].includes(path)
      || /(?:^|\/)(?:package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(path);
  });
}

export function classifyCoreTestImpact(changes, verified = new Set()) {
  const full = { ...fullCoreTestImpact(), storeDb: storeDatabaseImpact(changes) };
  if (!Array.isArray(changes) || !changes.length) return full;
  const selected = { unitMode: 'related', unitSources: [], unitOwners: [], storeDb: full.storeDb,
    smokeHome: false, smokePlayground: false, smokeNature: false, guides: false, assets: false };
  const owners = new Set();
  for (const change of changes) {
    if (storeScriptChange(change) || verifiedMigrationChange(change, verified)) {
      // SQL/script changes have no Vite import edge. Include the adapter and all
      // commerce owner tests, plus the real PostgreSQL suite via storeDb.
      selected.unitSources.push('lib/store/native.ts');
      owners.add(storeRoots); selected.storeDb = true;
      continue;
    }
    // Add/delete/rename and unusual file modes can remove graph edges. Keep
    // full units/browser checks instead of trying to reconstruct an old graph.
    if (!change || !validPath(change.path) || change.oldMode !== '100644' || change.newMode !== '100644') return full;
    if (prose.has(change.path)) continue;
    if (!/\.(?:ts|tsx)$/.test(change.path) || change.path.endsWith('.d.ts')) return full;
    const owner = coreOwners.find(owner => inDirectories(change.path, owner.roots));
    if (!owner || isSharedConfiguration(change.path)) return full;
    selected.unitSources.push(change.path);
    owners.add(owner.tests);
    if (owner.storeDb) selected.storeDb = true;
    owner.browser.forEach(name => { selected[name] = true; });
  }
  if (!selected.unitSources.length) return full; // docs-only handled by the existing scope gate
  selected.unitSources = [...new Set(selected.unitSources)];
  selected.unitOwners = [...owners];
  return selected;
}
