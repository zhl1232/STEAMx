#!/usr/bin/env node
/**
 * 清理 2026-08-13 分诊硬删除项目在 Aliyun OSS 上的对象。
 *
 * 按 scripts/lib/content-triage-2026-08-13.mjs 的 ID，从
 * projects.image_url、project_steps.image_url、comments.image_url 收集图片 URL。
 * 只删 projects/generated/ 与 projects/steps/ 下的 OSS key。
 * 跳过共用/默认封面、课件、Scratch、物种图。
 *
 * 用法：
 *   node scripts/purge-triaged-project-assets.mjs
 *   node scripts/purge-triaged-project-assets.mjs --execute
 *
 * 默认 dry-run。不要打印密钥。不要从本云端环境对生产执行 --execute。
 *
 * 环境变量（与其它脚本一样从 .env.local / .env 加载）：
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ALIYUN_OSS_*  （仅 --execute 时必须）
 *   NEXT_PUBLIC_ASSETS_BASE_URL / ASSETS_BASE_URL  （可选，用来解析 CDN URL）
 */

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TRIAGED_PROJECT_IDS_TO_DELETE,
  isProjectOwnedOssKey,
  ossKeyFromImageUrl,
  sqlIntegerList,
} from './lib/content-triage-2026-08-13.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

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
  const args = { execute: false }
  for (const token of argv) {
    if (token === '--execute') args.execute = true
    else if (token === '--dry-run') args.execute = false
  }
  return args
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

async function deleteOssKeys(keys) {
  const { createOssClient } = await import('../lib/utils/oss-client.mjs')
  const client = createOssClient()
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

await loadEnv()
const args = parseArgs(process.argv.slice(2))
const idListSql = sqlIntegerList(TRIAGED_PROJECT_IDS_TO_DELETE)
const assetsBaseUrl = (
  process.env.NEXT_PUBLIC_ASSETS_BASE_URL ||
  process.env.ASSETS_BASE_URL ||
  ''
).trim()

console.info(`内容分诊 OSS 清理（${args.execute ? 'EXECUTE' : 'dry-run'}）`)
console.info(`  项目 ID 数：${TRIAGED_PROJECT_IDS_TO_DELETE.length}`)

const urls = await collectImageUrls(idListSql)
const classified = {
  collected: urls.length,
  uniqueUrls: 0,
  ossCandidates: 0,
  skippedSharedOrForeign: 0,
  skippedNonOss: 0,
}

const uniqueUrls = [...new Set(urls)]
classified.uniqueUrls = uniqueUrls.length

const keysToDelete = new Set()
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
  keysToDelete.add(key)
  classified.ossCandidates += 1
}

for (const id of TRIAGED_PROJECT_IDS_TO_DELETE) {
  const padded = String(id).padStart(4, '0')
  for (const key of [
    `projects/generated/project-${padded}.webp`,
    `projects/generated/project-${padded}.png`,
    `projects/generated/project-${padded}.jpg`,
  ]) {
    if (isProjectOwnedOssKey(key)) keysToDelete.add(key)
  }
}

const keys = [...keysToDelete].sort()
console.info(`  已收集 URL：${classified.collected}（去重后 ${classified.uniqueUrls}）`)
console.info(`  已跳过非 OSS / Supabase Storage：${classified.skippedNonOss}`)
console.info(`  已跳过共用/默认/受保护对象：${classified.skippedSharedOrForeign}`)
console.info(`  将${args.execute ? '删除' : '删除（dry-run）'}的 OSS key 数：${keys.length}`)
for (const key of keys) {
  console.info(`    ${args.execute ? '删除' : '将删除'} ${key}`)
}

if (!args.execute) {
  console.info('dry-run 结束。确认后加 --execute 才会真正删除 OSS 对象。')
  process.exit(0)
}

if (keys.length === 0) {
  console.info('没有可删的对象。')
  process.exit(0)
}

const result = await deleteOssKeys(keys)
console.info(`  已删除：${result.deleted}`)
console.info(`  本来就不存在：${result.missing}`)
console.info(`  失败：${result.failed}`)
if (result.failed > 0) process.exit(1)
