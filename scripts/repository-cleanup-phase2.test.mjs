import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REMOVED = [
  'public/assets/bird-topic-campus-lake-hero.png',
  'public/assets/observation-list-reeds-sky-bg.png',
  'public/assets/species-archive-blue-tech-bg.png',
  'public/assets/profile-hero-explorer-v4.webp',
  ...['content', 'invite', 'messages', 'shop', 'wallet'].map(name => `public/assets/profile-actions/${name}.webp`),
]

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.error) throw result.error
  return result
}

function assertNoTrackedMatches(needles, scopes) {
  const result = git(['grep', '--no-textconv', '-I', '-n', '-F', ...needles.flatMap(value => ['-e', value]), '--', ...scopes])
  assert.equal(result.status, 1, result.stdout || result.stderr || 'git grep must complete with no matches')
}

test('phase2 removes exactly the reviewed legacy interface assets', () => {
  assert.equal(REMOVED.length, 9)
  for (const relative of REMOVED) assert.equal(existsSync(path.join(ROOT, relative)), false, relative)
})

test('phase2 leaves no tracked active reference to removed assets', () => {
  // Full checkout check, not an inference from GitHub search. Exclude this manifest-like test,
  // the audit report, E2E assertions and historical documents; retain SQL/config/current docs.
  assertNoTrackedMatches([
    'bird-topic-campus-lake-hero', 'observation-list-reeds-sky-bg',
    'species-archive-blue-tech-bg', 'profile-hero-explorer-v4', 'assets/profile-actions/',
  ], [
    'app', 'components', 'hooks', 'lib', 'packages', 'public', 'scripts', 'supabase', '.github',
    'docs', 'README.md', 'PROJECT_INDEX.md', 'package.json', 'next.config.mjs',
    ':(exclude)scripts/repository-cleanup-phase2.test.mjs',
    ':(exclude)docs/archive/**', ':(exclude)docs/maintenance/repository-cleanup-phase2.md',
  ])
})

test('phase2 retires the destructive workflow rather than changing its production arguments', () => {
  assert.equal(existsSync(path.join(ROOT, '.github/workflows/apply-content-triage-2026-08-13.yml')), false)
  assertNoTrackedMatches(['apply-content-triage-2026-08-13', 'purge-triaged-project-assets'], ['.github/workflows'])
  assert.ok(existsSync(path.join(ROOT, '.github/workflows/release.yml')))
  assert.ok(existsSync(path.join(ROOT, '.github/workflows/ci.yml')))
})

for (const filename of ['apply-content-triage-2026-08-13.mjs', 'generate-math-worksheet-assets.mjs']) {
  test(`retired command ${filename} refuses all old execution modes without side effects`, () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'steamx-retired-command-'))
    try {
      const envFile = path.join(cwd, '.env.local')
      writeFileSync(envFile, 'DO_NOT_READ_OR_CHANGE_THIS_FILE=1\n')
      for (const args of [[], ['--execute'], ['--dry-run'], ['--check'], ['--execute-resources']]) {
        const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', filename), ...args], {
          cwd, encoding: 'utf8', timeout: 5000,
          env: { PATH: process.env.PATH ?? '', LANG: 'C.UTF-8' },
        })
        assert.ifError(result.error)
        assert.equal(result.status, 1)
        assert.equal(result.stdout, '')
        assert.match(result.stderr, /\[RETIRED\]/)
        assert.match(result.stderr, /docs\/maintenance\/repository-cleanup-phase2\.md/)
        assert.deepEqual(readdirSync(cwd), ['.env.local'])
        assert.equal(readFileSync(envFile, 'utf8'), 'DO_NOT_READ_OR_CHANGE_THIS_FILE=1\n')
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
}

test('phase2 retains current UI assets and migration/asset safety boundaries', () => {
  for (const name of ['content', 'invite', 'messages', 'shop', 'wallet']) {
    assert.ok(existsSync(path.join(ROOT, `public/assets/profile-icons/action-${name}.webp`)))
  }
  for (const name of ['birds', 'insects', 'plants']) {
    assert.ok(existsSync(path.join(ROOT, `public/assets/nature-topic-${name}.webp`)))
  }
  for (const relative of [
    'public/assets/species-detail/bird-identification.png',
    'public/courses/ldraw/3-ai-fei-er-tie-ta.mpd',
    'public/xiaodi-ai/sprite.webp', 'public/xiaodi/sprite.webp',
    'public/manifests/projects.json',
    'supabase/migrations/20260813090000_hard_delete_triaged_projects.sql',
    'supabase/migrations/20260826090000_math_worksheet_assets.sql',
    'scripts/purge-triaged-project-assets.mjs', 'scripts/db-push.mjs',
  ]) assert.ok(existsSync(path.join(ROOT, relative)), relative)
})

// Historical text is recoverable from Git. Keep useful safety assertions above,
// not a permanent requirement to copy obsolete implementations into the tree.
test('context cleanup removes unused editors and redundant snapshots', () => {
  const retiredPaths = [
    '.kiro', '.trae', '.agent/skills/project-seed',
    '.codex/leaderboard-mobile-header-check.png',
    '.codex/profile-mobile-header-check.png',
    'docs/archive/documentation/2026-10-13',
    'docs/archive/scripts/2026-10-13',
    'docs/archive/maintenance/2026-10-13-phase2',
    'docs/maintenance/repository-cleanup-phase2-index-review.json',
  ]
  const result = git(['ls-files', '-z', '--', ...retiredPaths])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '', 'retired context must not remain tracked, including dangling symlinks')
})

test('context cleanup leaves no active references to removed snapshots or editors', () => {
  assertNoTrackedMatches([
    'archive/documentation/2026-10-13', 'archive/scripts/2026-10-13',
    'archive/maintenance/2026-10-13-phase2', 'repository-cleanup-phase2-index-review.json',
    '.kiro/', '.trae/', '.agent/skills/project-seed',
    'leaderboard-mobile-header-check.png', 'profile-mobile-header-check.png',
  ], [
    'app', 'components', 'hooks', 'lib', 'packages', 'scripts', 'supabase', '.github',
    '.agent', '.agents', '.claude', '.cursor', 'docs', 'README.md', 'PROJECT_INDEX.md', 'AGENTS.md',
    ':(exclude)scripts/repository-cleanup-phase2.test.mjs', ':(exclude)docs/archive/**',
  ])
})
