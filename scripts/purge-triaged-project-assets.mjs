#!/usr/bin/env node
/**
 * Purge Aliyun OSS objects that belong to the 2026-08-13 triaged STEAMx projects.
 *
 * Collects image URLs from projects.image_url, project_steps.image_url, and
 * comments.image_url for scripts/lib/content-triage-2026-08-13.mjs IDs.
 * Deletes only OSS keys under projects/generated/ and projects/steps/.
 * Skips shared/default covers, courseware, Scratch, and species assets.
 *
 * Usage:
 *   node scripts/purge-triaged-project-assets.mjs
 *   node scripts/purge-triaged-project-assets.mjs --execute
 *
 * Dry-run is the default. Never prints secrets.
 *
 * Env (loaded from .env.local / .env like other scripts):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ALIYUN_OSS_*  (only required with --execute)
 *   NEXT_PUBLIC_ASSETS_BASE_URL / ASSETS_BASE_URL  (optional, to resolve CDN URLs)
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
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
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
    throw new Error(`Database query failed with HTTP ${response.status}`)
  }
  const data = await response.json()
  if (data && !Array.isArray(data) && data.error) {
    throw new Error('Database query returned an error')
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item?.error) throw new Error('Database query returned an error')
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
        console.error(`  failed key=${key} code=${code || 'unknown'}`)
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

console.info(`Content triage OSS purge (${args.execute ? 'EXECUTE' : 'dry-run'})`)
console.info(`  project ids: ${TRIAGED_PROJECT_IDS_TO_DELETE.length}`)

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

const keys = [...keysToDelete].sort()
console.info(`  urls collected: ${classified.collected} (${classified.uniqueUrls} unique)`)
console.info(`  skipped non-OSS / supabase storage: ${classified.skippedNonOss}`)
console.info(`  skipped shared/default/protected: ${classified.skippedSharedOrForeign}`)
console.info(`  OSS keys to ${args.execute ? 'delete' : 'delete (dry-run)'}: ${keys.length}`)
for (const key of keys) {
  console.info(`    ${args.execute ? 'delete' : 'would-delete'} ${key}`)
}

if (!args.execute) {
  console.info('Dry-run complete. Re-run with --execute to delete OSS objects.')
  process.exit(0)
}

if (keys.length === 0) {
  console.info('Nothing to delete.')
  process.exit(0)
}

const result = await deleteOssKeys(keys)
console.info(`  deleted: ${result.deleted}`)
console.info(`  already missing: ${result.missing}`)
console.info(`  failed: ${result.failed}`)
if (result.failed > 0) process.exit(1)
