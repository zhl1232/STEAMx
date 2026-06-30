#!/usr/bin/env node
/**
 * One-shot migration: upload public/ static assets to Aliyun OSS,
 * then generate manifest JSON files used at runtime by the app.
 *
 * Usage:
 *   node scripts/migrate-public-to-oss.mjs
 *   node scripts/migrate-public-to-oss.mjs --only=scratch-assets
 *   node scripts/migrate-public-to-oss.mjs --only=project-covers
 *
 * 环境变量从 .env.local 自动读取（与 pnpm db:push 相同），也可手动 export：
 *   ALIYUN_OSS_ACCESS_KEY_ID / ALIYUN_OSS_ACCESS_KEY_SECRET / ALIYUN_OSS_BUCKET
 *   ALIYUN_OSS_REGION=oss-cn-hangzhou
 *   NEXT_PUBLIC_ASSETS_BASE_URL=https://assets.example.com
 *
 * Optional flags:
 *   --skip-upload          Only regenerate manifests from local files (no OSS calls)
 *   --only=birds,projects  Only process the given groups
 *   --concurrency=16       Upload concurrency (default 16)
 *   --dry-run              Print what would be uploaded without actually uploading
 *
 * Outputs:
 *   public/manifests/birds.json
 *   public/manifests/insects.json
 *   public/manifests/trees.json
 *   public/manifests/fruits.json
 *   public/manifests/projects.json
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { convertCourseImagesToWebp } from './lib/course-image-webp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PUBLIC_DIR = path.join(ROOT, 'public')
const MANIFESTS_DIR = path.join(PUBLIC_DIR, 'manifests')

async function loadEnv() {
  for (const filename of ['.env.local', '.env']) {
    const envPath = path.join(ROOT, filename)
    if (!existsSync(envPath)) continue
    const content = await fs.readFile(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  }
}

const GROUPS = [
  { id: 'birds', localDir: 'public/birds', publicPrefix: 'birds', manifest: 'birds.json', kind: 'species', imageSubdir: 'images' },
  { id: 'insects', localDir: 'public/insects', publicPrefix: 'insects', manifest: 'insects.json', kind: 'species', imageSubdir: 'images' },
  { id: 'trees', localDir: 'public/trees', publicPrefix: 'trees', manifest: 'trees.json', kind: 'species', imageSubdir: 'images' },
  { id: 'fruits', localDir: 'public/fruits/images', publicPrefix: 'fruits/images', manifest: 'fruits.json', kind: 'species', imageSubdir: 'images', manifestRootDir: 'public/fruits', manifestPublicPrefix: 'fruits' },
  { id: 'project-covers', localDir: 'public/projects', publicPrefix: 'projects', manifest: null, kind: 'flat', recursive: false },
  { id: 'projects', localDir: 'public/projects/generated', publicPrefix: 'projects/generated', manifest: 'projects.json', kind: 'flat' },
  { id: 'project-steps', localDir: 'public/projects/steps', publicPrefix: 'projects/steps', manifest: null, kind: 'flat' },
  { id: 'scratch-assets', localDir: 'public/scratch/assets', publicPrefix: 'scratch/assets', manifest: null, kind: 'flat' },
  // 课程素材（课件图/视频/PDF/成品图/LDraw 模型）。由 scripts/import-courseware.mjs 暂存到
  // public/courses/<slug>/，这里批量推到 oss:courses/<slug>/。递归、无 manifest。
  { id: 'courses', localDir: 'public/courses', publicPrefix: 'courses', manifest: null, kind: 'flat', recursive: true },
]

function parseArgs(argv) {
  const args = { skipUpload: false, only: null, concurrency: 16, dryRun: false }
  for (const token of argv) {
    if (token === '--skip-upload') args.skipUpload = true
    else if (token === '--dry-run') args.dryRun = true
    else if (token.startsWith('--only=')) args.only = new Set(token.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean))
    else if (token.startsWith('--concurrency=')) args.concurrency = Number(token.split('=')[1] || 16)
  }
  return args
}

const SPECIES_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

function compareSpeciesImage(left, right) {
  const re = /-(\d+)\.[^.]+$/i
  const ln = Number(left.match(re)?.[1] ?? Number.POSITIVE_INFINITY)
  const rn = Number(right.match(re)?.[1] ?? Number.POSITIVE_INFINITY)
  return ln !== rn ? ln - rn : left.localeCompare(right)
}

async function buildSpeciesManifest(group) {
  const manifestRootDir = group.manifestRootDir ?? group.localDir
  const imageDir = path.join(ROOT, manifestRootDir, group.imageSubdir)
  if (!existsSync(imageDir)) {
    console.warn(`  (skip manifest: ${imageDir} does not exist)`)
    return null
  }

  const entries = await fs.readdir(imageDir, { withFileTypes: true })
  const filesBySlug = new Map()

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!SPECIES_IMAGE_EXT.has(ext)) continue

    const baseName = entry.name.slice(0, -ext.length)
    const slug = baseName.replace(/-\d+$/, '')
    if (!filesBySlug.has(slug)) filesBySlug.set(slug, [])
    filesBySlug.get(slug).push(entry.name)
  }

  const manifest = {}
  const manifestPublicPrefix = group.manifestPublicPrefix ?? group.publicPrefix
  const sortedSlugs = Array.from(filesBySlug.keys()).sort()
  for (const slug of sortedSlugs) {
    const files = filesBySlug.get(slug).sort(compareSpeciesImage)
    manifest[slug] = files.map((name) => `/${manifestPublicPrefix}/${group.imageSubdir}/${name}`)
  }
  return manifest
}

async function buildProjectsManifest(group) {
  const dir = path.join(ROOT, group.localDir)
  if (!existsSync(dir)) {
    console.warn(`  (skip manifest: ${dir} does not exist)`)
    return null
  }

  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /\.(webp|png|jpg|jpeg)$/i.test(name))
    .sort()

  return {
    files: files.map((name) => `/${group.publicPrefix}/${name}`),
  }
}

async function writeManifest(group, manifest) {
  if (!manifest || !group.manifest) return

  await fs.mkdir(MANIFESTS_DIR, { recursive: true })
  const manifestPath = path.join(MANIFESTS_DIR, group.manifest)
  const json = JSON.stringify(manifest, null, 2) + '\n'
  await fs.writeFile(manifestPath, json, 'utf8')
  const count = group.kind === 'species'
    ? Object.keys(manifest).length
    : (manifest.files?.length ?? 0)
  console.log(`  ✓ wrote ${path.relative(ROOT, manifestPath)} (${count} entries)`)
}

async function processGroup(group, args, client, uploadDirectory) {
  console.log(`\n# Group: ${group.id}`)

  const localPath = path.join(ROOT, group.localDir)
  if (!existsSync(localPath)) {
    console.warn(`  (skip: ${localPath} does not exist)`)
    return
  }

  if (group.id === 'courses' && !args.skipUpload && !args.dryRun) {
    const result = await convertCourseImagesToWebp(localPath, {
      recursive: true,
      filter(filePath) {
        const relativePath = path.relative(localPath, filePath).split(path.sep).join('/')
        return /(^|\/)slides\/[^/]+\.(png|jpe?g)$/i.test(relativePath) || /(^|\/)finished\.(png|jpe?g)$/i.test(relativePath)
      },
    })
    if (result.converted > 0) {
      const saved = result.beforeBytes > 0 ? Math.round((1 - result.afterBytes / result.beforeBytes) * 100) : 0
      console.log(
        `  ✓ converted course images to WebP: ${(result.beforeBytes / 1e6).toFixed(1)}MB -> ${(result.afterBytes / 1e6).toFixed(1)}MB (${saved}% saved)`,
      )
    }
  }

  if (!args.skipUpload && !args.dryRun) {
    if (!client || !uploadDirectory) {
      throw new Error('OSS client was not initialized')
    }
    await uploadDirectory(client, {
      localDir: localPath,
      publicPathPrefix: group.publicPrefix,
      concurrency: args.concurrency,
      recursive: group.recursive ?? true,
    })
  } else if (args.dryRun) {
    const files = []
    async function count(dir) {
      const items = await fs.readdir(dir, { withFileTypes: true })
      for (const it of items) {
        const p = path.join(dir, it.name)
        if (it.isDirectory()) {
          if (group.recursive !== false) await count(p)
        } else if (it.isFile()) {
          files.push(p)
        }
      }
    }
    await count(localPath)
    console.log(`  [dry-run] would upload ${files.length} files to oss:${group.publicPrefix}/`)
  } else {
    console.log(`  (upload skipped via --skip-upload)`)
  }

  if (group.manifest) {
    const manifest =
      group.kind === 'species'
        ? await buildSpeciesManifest(group)
        : await buildProjectsManifest(group)
    await writeManifest(group, manifest)
  }
}

async function main() {
  await loadEnv()
  const args = parseArgs(process.argv.slice(2))
  const groups = args.only ? GROUPS.filter((g) => args.only.has(g.id)) : GROUPS

  if (groups.length === 0) {
    console.error('No groups selected. Available:', GROUPS.map((g) => g.id).join(', '))
    process.exit(1)
  }

  let client = null
  let uploadDirectory = null
  if (!args.skipUpload && !args.dryRun) {
    const oss = await import('../lib/utils/oss-client.mjs')
    uploadDirectory = oss.uploadDirectory
    const createOssClient = oss.createOssClient
    client = createOssClient()
  }

  for (const group of groups) {
    await processGroup(group, args, client, uploadDirectory)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
