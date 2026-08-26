#!/usr/bin/env node
/**
 * 清理项目目录硬删除批次在 Aliyun OSS 上的对象，以及本地
 * public/projects/generated 与 public/projects/steps 下的对应文件。
 *
 * 按选定批次的 ID 收集对象：
 *   1. 库里 projects / project_steps / comments 的 image_url（行还在时）
 *   2. 列举 OSS `projects/generated/` 与 `projects/steps/`，按文件名里的项目 ID 匹配
 *   3. 库行已删时仍按约定封面名 + 历史迁移里的步骤图名兜底
 *
 * 只删 projects/generated/ 与 projects/steps/ 下该项目自己的对象。
 * 跳过共用/默认封面、课件、Scratch、物种图、Supabase Storage。
 *
 * 用法：
 *   node scripts/purge-triaged-project-assets.mjs
 *   node scripts/purge-triaged-project-assets.mjs --execute
 *   node scripts/purge-triaged-project-assets.mjs --scope=2026-08-25 --dry-run
 *
 * 默认 dry-run。不要打印密钥。
 *
 * 环境变量（与其它脚本一样从 .env.local / .env 加载）：
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ALIYUN_OSS_*  （列举 OSS 与 --execute 删除时必须）
 *   NEXT_PUBLIC_ASSETS_BASE_URL / ASSETS_BASE_URL  （可选，用来解析 CDN URL）
 */

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TRIAGED_PROJECT_IDS_TO_DELETE,
  conventionalGeneratedCoverKeys,
  isOwnedOssKeyForProjectIds,
  isProjectOwnedOssKey,
  ossKeyFromImageUrl,
  sqlIntegerList,
} from './lib/content-triage-2026-08-13.mjs'
import {
  PROJECT_CONTENT_CLEANUP_DATE,
  PROJECT_CONTENT_CLEANUP_PROJECT_IDS,
} from './lib/project-content-cleanup-2026-08-25.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const LOCAL_PROJECT_DIRS = Object.freeze([
  path.join(ROOT, 'public/projects/generated'),
  path.join(ROOT, 'public/projects/steps'),
])
const OSS_LIST_PREFIXES = Object.freeze(['projects/generated/', 'projects/steps/'])
const GENERATED_MANIFEST_PATH = path.join(ROOT, 'public/projects/generated/manifest.json')
const PROJECTS_MANIFEST_PATH = path.join(ROOT, 'public/manifests/projects.json')
const CLEANUP_SCOPES = Object.freeze({
  '2026-08-13': {
    label: '2026-08-13 内容分诊',
    projectIds: TRIAGED_PROJECT_IDS_TO_DELETE,
  },
  [PROJECT_CONTENT_CLEANUP_DATE]: {
    label: '2026-08-25 项目目录清理',
    projectIds: PROJECT_CONTENT_CLEANUP_PROJECT_IDS,
  },
})

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
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  }
}

function parseArgs(argv) {
  const args = {
    execute: false,
    skipLocal: false,
    skipManifest: false,
    scope: '2026-08-13',
  }
  for (const token of argv) {
    if (token === '--execute') args.execute = true
    else if (token === '--dry-run') args.execute = false
    else if (token === '--no-local') args.skipLocal = true
    else if (token === '--no-manifest') args.skipManifest = true
    else if (token.startsWith('--scope=')) args.scope = token.slice('--scope='.length)
  }
  return args
}

function hasOssEnv() {
  return Boolean(
    process.env.ALIYUN_OSS_ACCESS_KEY_ID &&
    process.env.ALIYUN_OSS_ACCESS_KEY_SECRET &&
    process.env.ALIYUN_OSS_BUCKET &&
    (process.env.ALIYUN_OSS_REGION || process.env.ALIYUN_OSS_ENDPOINT),
  )
}

async function execSQL(sql) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  }

  const response = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    throw new Error(`数据库查询失败，HTTP ${response.status}`)
  }
  const data = await response.json()
  if (data && !Array.isArray(data) && data.error) {
    throw new Error('数据库查询返回了错误')
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item?.error) throw new Error('数据库查询返回了错误')
    }
  }
  return data ?? []
}

function collectUrlsFromRow(row) {
  const urls = []
  for (const value of Object.values(row || {})) {
    if (typeof value === 'string' && value.trim()) urls.push(value.trim())
  }
  return urls
}

async function countRemainingProjects(idListSql) {
  const rows = await execSQL(`
    SELECT count(*)::int AS remaining
    FROM public.projects
    WHERE id IN (${idListSql})
  `)
  const remaining = Number(rows?.[0]?.remaining ?? rows?.[0]?.count ?? 0)
  return Number.isFinite(remaining) ? remaining : 0
}

async function collectImageUrls(idListSql) {
  const rows = await execSQL(`
    SELECT image_url AS url, 'projects' AS source
    FROM public.projects
    WHERE id IN (${idListSql})
      AND image_url IS NOT NULL
      AND btrim(image_url) <> ''
    UNION ALL
    SELECT image_url AS url, 'project_steps' AS source
    FROM public.project_steps
    WHERE project_id IN (${idListSql})
      AND image_url IS NOT NULL
      AND btrim(image_url) <> ''
    UNION ALL
    SELECT image_url AS url, 'comments' AS source
    FROM public.comments
    WHERE project_id IN (${idListSql})
      AND image_url IS NOT NULL
      AND btrim(image_url) <> ''
  `)

  const collected = []
  for (const row of rows) {
    const url = typeof row?.url === 'string' ? row.url.trim() : ''
    if (!url) {
      collected.push(...collectUrlsFromRow(row).filter((value) => value !== row?.source))
      continue
    }
    collected.push(url)
  }
  return collected
}

function addOwnedKey(keys, key, reason, reasons) {
  if (!key || !isOwnedOssKeyForProjectIds(key, DELETE_ID_SET)) return false
  const existed = keys.has(key)
  keys.add(key)
  if (!existed) reasons.set(key, reason)
  return !existed
}

async function collectStepKeysFromMigrations() {
  const dir = path.join(ROOT, 'supabase/migrations')
  const files = await fs.readdir(dir)
  const keys = new Set()
  const re = /(?:^|["'\s(])(?:\/)?(projects\/steps\/step-(\d+)[-a-z0-9._]*)/gi
  for (const file of files) {
    if (!file.endsWith('.sql')) continue
    const text = await fs.readFile(path.join(dir, file), 'utf8')
    for (const match of text.matchAll(re)) {
      const key = match[1]
      if (isOwnedOssKeyForProjectIds(key, DELETE_ID_SET)) keys.add(key)
    }
  }
  return [...keys]
}

async function listOssPrefix(client, prefix) {
  const names = []
  let continuationToken
  do {
    const response = await client.listV2(
      {
        prefix,
        'max-keys': 1000,
        ...(continuationToken ? { continuationToken } : {}),
      },
      {},
    )
    for (const object of response.objects || []) {
      if (object?.name) names.push(object.name)
    }
    continuationToken = response.nextContinuationToken
  } while (continuationToken)
  return names
}

async function collectLocalOwnedFiles() {
  const files = []
  for (const dir of LOCAL_PROJECT_DIRS) {
    if (!existsSync(dir)) continue
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const relative = path.posix.join('projects', path.basename(dir), entry.name)
      if (!isOwnedOssKeyForProjectIds(relative, DELETE_ID_SET)) continue
      files.push({
        absPath: path.join(dir, entry.name),
        key: relative,
      })
    }
  }
  return files.sort((a, b) => a.key.localeCompare(b.key))
}

async function deleteOssKeys(client, keys) {
  let deleted = 0
  let missing = 0
  let failed = 0

  for (const key of keys) {
    try {
      await client.delete(key, { timeout: 60_000 })
      deleted += 1
    } catch (err) {
      const code = err?.code || err?.name || ''
      const status = err?.status || err?.statusCode
      if (code === 'NoSuchKey' || status === 404) {
        missing += 1
      } else {
        failed += 1
        console.error(`  删除失败 key=${key} code=${code || 'unknown'}`)
      }
    }
  }

  return { deleted, missing, failed }
}

async function deleteLocalFiles(files) {
  let deleted = 0
  let missing = 0
  let failed = 0
  for (const file of files) {
    try {
      await fs.unlink(file.absPath)
      deleted += 1
    } catch (err) {
      if (err?.code === 'ENOENT') missing += 1
      else {
        failed += 1
        console.error(`  本地删除失败 path=${file.absPath}`)
      }
    }
  }
  return { deleted, missing, failed }
}

function pruneProjectsManifest(manifest, label) {
  if (!manifest || typeof manifest !== 'object') {
    return { changed: false, removed: 0, next: manifest }
  }

  if (Array.isArray(manifest.files)) {
    const nextFiles = manifest.files.filter((value) => {
      const key = ossKeyFromImageUrl(typeof value === 'string' ? value : '')
      return !(key && isOwnedOssKeyForProjectIds(key, DELETE_ID_SET))
    })
    const removed = manifest.files.length - nextFiles.length
    return {
      changed: removed > 0,
      removed,
      next: { ...manifest, files: nextFiles },
      label,
    }
  }

  if (Array.isArray(manifest)) {
    const next = manifest.filter((entry) => {
      const id = Number(entry?.index)
      if (Number.isInteger(id) && DELETE_ID_SET.has(id)) return false
      const key = ossKeyFromImageUrl(typeof entry?.imageUrl === 'string' ? entry.imageUrl : '')
      return !(key && isOwnedOssKeyForProjectIds(key, DELETE_ID_SET))
    })
    const removed = manifest.length - next.length
    return { changed: removed > 0, removed, next, label }
  }

  return { changed: false, removed: 0, next: manifest, label }
}

async function pruneManifestFile(absPath, label) {
  if (!existsSync(absPath)) return { changed: false, removed: 0, path: absPath, label }
  const raw = JSON.parse(await fs.readFile(absPath, 'utf8'))
  const result = pruneProjectsManifest(raw, label)
  if (result.changed) {
    await fs.writeFile(absPath, `${JSON.stringify(result.next, null, 2)}\n`, 'utf8')
  }
  return { ...result, path: absPath }
}

await loadEnv()
const args = parseArgs(process.argv.slice(2))
const cleanupScope = CLEANUP_SCOPES[args.scope]
if (!cleanupScope) {
  throw new Error(`未知资源清理 scope: ${args.scope}；可选值：${Object.keys(CLEANUP_SCOPES).join(', ')}`)
}
const DELETE_PROJECT_IDS = cleanupScope.projectIds
const DELETE_ID_SET = new Set(DELETE_PROJECT_IDS)
const idListSql = sqlIntegerList(DELETE_PROJECT_IDS)
const assetsBaseUrl = (
  process.env.NEXT_PUBLIC_ASSETS_BASE_URL ||
  process.env.ASSETS_BASE_URL ||
  ''
).trim()

console.info(`${cleanupScope.label} OSS 清理（${args.execute ? 'EXECUTE' : 'dry-run'}）`)
console.info(`  项目 ID 数：${DELETE_PROJECT_IDS.length}`)

const remainingProjects = await countRemainingProjects(idListSql)
console.info(`  库中仍存在的分诊项目：${remainingProjects}`)

const urls = await collectImageUrls(idListSql)
const classified = {
  collected: urls.length,
  uniqueUrls: 0,
  fromDb: 0,
  fromOssList: 0,
  fromConvention: 0,
  fromMigrations: 0,
  skippedSharedOrForeign: 0,
  skippedNonOss: 0,
}

const uniqueUrls = [...new Set(urls)]
classified.uniqueUrls = uniqueUrls.length

const keysToDelete = new Set()
const reasons = new Map()

for (const url of uniqueUrls) {
  const key = ossKeyFromImageUrl(url, assetsBaseUrl)
  if (!key) {
    classified.skippedNonOss += 1
    continue
  }
  if (!isProjectOwnedOssKey(key)) {
    classified.skippedSharedOrForeign += 1
    continue
  }
  if (addOwnedKey(keysToDelete, key, 'db', reasons)) classified.fromDb += 1
}

let ossClient = null
let ossListError = null
let ossListSucceeded = false
const listedByPrefix = {}
if (hasOssEnv()) {
  const { createOssClient } = await import('../lib/utils/oss-client.mjs')
  ossClient = createOssClient()
  try {
    for (const prefix of OSS_LIST_PREFIXES) {
      const names = await listOssPrefix(ossClient, prefix)
      listedByPrefix[prefix] = names.length
      for (const name of names) {
        if (addOwnedKey(keysToDelete, name, 'oss-list', reasons)) classified.fromOssList += 1
      }
    }
    ossListSucceeded = true
  } catch (err) {
    ossListError = err?.code || err?.message || 'unknown'
    console.error(`  OSS 列举失败：${ossListError}（继续用库 URL / 约定名 / 迁移名）`)
  }
} else {
  console.info('  未配置 ALIYUN_OSS_*，跳过 OSS 列举')
}

if (!ossListSucceeded) {
  for (const key of conventionalGeneratedCoverKeys(DELETE_PROJECT_IDS)) {
    if (addOwnedKey(keysToDelete, key, 'convention', reasons)) classified.fromConvention += 1
  }
  for (const key of await collectStepKeysFromMigrations()) {
    if (addOwnedKey(keysToDelete, key, 'migration', reasons)) classified.fromMigrations += 1
  }
}

const localFiles = args.skipLocal ? [] : await collectLocalOwnedFiles()
const keys = [...keysToDelete].sort()

console.info(`  已收集 URL：${classified.collected}（去重后 ${classified.uniqueUrls}）`)
console.info(`  已跳过非 OSS / Supabase Storage：${classified.skippedNonOss}`)
console.info(`  已跳过共用/默认/受保护对象：${classified.skippedSharedOrForeign}`)
if (Object.keys(listedByPrefix).length > 0) {
  console.info(
    `  OSS 列举：generated ${listedByPrefix['projects/generated/'] ?? 0}，steps ${listedByPrefix['projects/steps/'] ?? 0}`,
  )
}
console.info(`  候选来源：库 ${classified.fromDb} / OSS列举新增 ${classified.fromOssList} / 约定封面 ${classified.fromConvention} / 历史迁移 ${classified.fromMigrations}`)
console.info(`  将${args.execute ? '删除' : '删除（dry-run）'}的 OSS key 数：${keys.length}`)
for (const key of keys) {
  console.info(`    ${args.execute ? '删除' : '将删除'} ${key}  [${reasons.get(key) || 'unknown'}]`)
}
console.info(`  本地文件：${localFiles.length}`)
for (const file of localFiles) {
  console.info(`    ${args.execute ? '删除' : '将删除'} ${path.relative(ROOT, file.absPath)}`)
}

if (!args.skipManifest) {
  for (const [absPath, label] of [
    [GENERATED_MANIFEST_PATH, 'generated/manifest.json'],
    [PROJECTS_MANIFEST_PATH, 'manifests/projects.json'],
  ]) {
    if (!existsSync(absPath)) continue
    const raw = JSON.parse(await fs.readFile(absPath, 'utf8'))
    const preview = pruneProjectsManifest(raw, label)
    console.info(`  清单 ${label}：将去掉 ${preview.removed} 条`)
  }
}

if (!args.execute) {
  console.info('dry-run 结束。确认后加 --execute 才会真正删除 OSS 对象和本地文件。')
  process.exit(0)
}

if (!ossClient) {
  console.error('缺少 ALIYUN_OSS_*，无法删除 OSS 对象。')
  process.exit(1)
}

const ossResult = keys.length === 0
  ? { deleted: 0, missing: 0, failed: 0 }
  : await deleteOssKeys(ossClient, keys)
console.info(`  OSS 已删除：${ossResult.deleted}`)
console.info(`  OSS 本来就不存在：${ossResult.missing}`)
console.info(`  OSS 失败：${ossResult.failed}`)

const localResult = await deleteLocalFiles(localFiles)
console.info(`  本地已删除：${localResult.deleted}`)
console.info(`  本地本来就不存在：${localResult.missing}`)
console.info(`  本地失败：${localResult.failed}`)

if (!args.skipManifest) {
  for (const [absPath, label] of [
    [GENERATED_MANIFEST_PATH, 'generated/manifest.json'],
    [PROJECTS_MANIFEST_PATH, 'manifests/projects.json'],
  ]) {
    const result = await pruneManifestFile(absPath, label)
    if (!existsSync(absPath) && result.removed === 0) continue
    console.info(`  清单 ${label}：已去掉 ${result.removed} 条`)
  }
}

if (ossResult.failed > 0 || localResult.failed > 0) process.exit(1)
if (ossListError && keys.length === 0) process.exit(1)
