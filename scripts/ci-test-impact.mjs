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
  'components/support/', 'components/shop/', 'lib/support/',
];

// Directory ownership is explicit; shared dependencies outside these namespaces
// deliberately fall through to full. The fixtures import building UI and LDraw
// in both outline and Vosk, and share registration's link/image and outline mocks.
const rules = [
  { directories: ['app/playground/physics-lab/', 'app/api/physics-lab/',
    'hooks/physics-lab/', 'lib/physics-lab/', 'public/physics-lab/', 'tests/physics-lab/'],
    files: ['e2e/physics-lab.spec.ts'], enabled: ['physics'] },
  { directories: ['app/project/', 'components/features/project/', 'lib/project/',
    'lib/mappers/', 'e2e/project-video-pilot/', 'components/store/', 'lib/store/', 'lib/shop/'],
    // The real project page renders author avatars and contextual store content.
    files: ['__tests__/fixtures/project-video-pilot.json', 'components/ui/user-avatar.tsx',
      'components/ui/user-avatar.test.tsx'], enabled: ['projectVideo'] },
  { directories: ['public/courses/vosk/', 'e2e/building-vosk/', 'e2e/building-kws/',
    'app/api/tutor/speech/'], files: [], enabled: ['voice'] },
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

export function classifyTestImpact(changes) {
  if (!Array.isArray(changes) || !changes.length) return full('Missing or empty change records');
  const enabled = new Set();
  for (const change of changes) {
    if (!change || !validPath(change.path)
        || !['000000', '100644'].includes(change.oldMode)
        || !['000000', '100644'].includes(change.newMode)
        || (change.oldMode === '000000' && change.newMode === '000000')) {
      return full('Invalid path, missing record or unexpected file modes');
    }
    const path = change.path;
    // Even inside an owned directory, tool/dependency configuration is shared.
    const basename = path.split('/').at(-1);
    const dependencyFile = /^(?:package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|tsconfig(?:\..+)?\.json)$/.test(basename);
    const toolConfig = /(?:^|\.)config\.(?:[cm]?[jt]s|json)$/.test(basename)
      && path !== 'lib/support/feishu/config.ts';
    if (dependencyFile || toolConfig) {
      return full('Dependency or tool configuration changed');
    }
    if (prose.has(path) || unrelatedFiles.has(path) || inDirectories(path, unrelatedDirectories)) continue;
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
    if (!rule) return full('Unknown or shared path; run every specialty');
    for (const name of rule.enabled) enabled.add(name);
  }
  return result([...enabled], enabled.size
    ? `Reviewed module ownership selects: ${[...enabled].join(', ')}`
    : 'Reviewed unrelated modules or prose; specialties not run');
}
