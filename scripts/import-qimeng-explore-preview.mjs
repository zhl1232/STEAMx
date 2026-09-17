#!/usr/bin/env node
/**
 * Import 启蒙版 partner experiments into STEAMx explore projects.
 *
 * Usage:
 *   node scripts/import-qimeng-explore-preview.mjs --limit=10
 *   node scripts/import-qimeng-explore-preview.mjs --limit=248
 *   node scripts/import-qimeng-explore-preview.mjs --limit=248 --dry-run
 *   node scripts/import-qimeng-explore-preview.mjs --source=/path/to/启蒙版 --limit=248
 *
 * Requires .env.local (or env):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPPORT_USER_ID
 *   ALIYUN_OSS_* (+ NEXT_PUBLIC_ASSETS_BASE_URL for video HTTPS links)
 *
 * Does NOT print secrets. Idempotent via tag `qimeng-src:{sourceId}`.
 *
 * Covers → Supabase storage `project-images` (same as explore projects).
 * Videos → OSS under qimeng-preview/; HTTPS CDN URL stored on projects.video_url.
 * CDN may require site Referer — detail page prefers /api/assets proxy.
 *
 * Tags: 启蒙版 + qimeng-src:{sourceId} (plus topical tags). Do not write 预览,
 * 【预览】 titles, or preview boilerplate in description / steps.
 */

import { readFile, access, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createOssClient } from '../lib/utils/oss-client.mjs'
import {
  buildQimengDescription,
  isDuplicateQimengReflection,
  parseQimengContentTxt,
  qimengMaterialsOrFallback,
  qimengStepsOrFallback,
  TAG_SOURCE,
  TITLE_PREFIX,
} from './lib/qimeng-preview-copy.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DEFAULT_SOURCE = '/workspace/zwlhome-save/启蒙版'

const CATEGORY = '科学'
const OSS_PREFIX = 'qimeng-preview'
const PROGRESS_EVERY = 5

function parseArgs(argv) {
  const args = {
    limit: 10,
    dryRun: false,
    source: DEFAULT_SOURCE,
    skipVideo: false,
    force: false,
  }
  for (const token of argv) {
    if (token === '--dry-run') args.dryRun = true
    else if (token === '--skip-video') args.skipVideo = true
    else if (token === '--force') args.force = true
    else if (token.startsWith('--limit=')) args.limit = Math.max(1, Number.parseInt(token.slice(8), 10) || 10)
    else if (token.startsWith('--source=')) args.source = token.slice(9)
  }
  return args
}

async function loadEnv() {
  try {
    const content = await readFile(path.join(ROOT, '.env.local'), 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const i = trimmed.indexOf('=')
      if (i < 0) continue
      const key = trimmed.slice(0, i).trim()
      const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '')
      // Prefer .env.local over any pre-injected placeholder values on the box.
      process.env[key] = value
    }
  } catch {
    // env may already be injected
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

async function pgQuery(sql) {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!response.ok) {
    throw new Error(`pg/query HTTP ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  }
  if (Array.isArray(data)) {
    const error = data.find((item) => item?.error)
    if (error) throw new Error(error.error)
  }
  return data
}

function sqlLiteral(value) {
  return String(value).replaceAll("'", "''")
}

async function reviewProjectClassification({ projectId, expectedRevision, reviewerId }) {
  const key = randomUUID()
  const sql = `
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT public.review_content_classification(
  'project'::text,
  ${Number(projectId)}::bigint,
  ${Number(expectedRevision)}::bigint,
  'approve'::text,
  3::smallint,
  8::smallint,
  'guided'::text,
  1::smallint,
  '${sqlLiteral('启蒙版预览导入自动分级审核')}'::text,
  '${key}'::uuid,
  '${sqlLiteral(reviewerId)}'::uuid
) AS result;
`
  return pgQuery(sql)
}

function assetsBaseUrl() {
  return (process.env.NEXT_PUBLIC_ASSETS_BASE_URL || '').replace(/\/+$/, '')
}

function sourceTag(sourceId) {
  return `qimeng-src:${sourceId}`
}

function expectedVideoUrl(folder) {
  const base = assetsBaseUrl()
  if (!base || !folder) return null
  return `${base}/${OSS_PREFIX}/${folder}/video_1.mp4`
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function parseContentTxt(text) {
  return parseQimengContentTxt(text)
}

function buildDescription({ principle, digest }) {
  return buildQimengDescription({ principle, digest })
}

async function loadIndex(sourceRoot) {
  const indexPath = path.join(sourceRoot, 'index.json')
  const raw = JSON.parse(await readFile(indexPath, 'utf8'))
  if (!Array.isArray(raw)) throw new Error('index.json must be an array')
  return raw
}

function pickBatch(index, limit) {
  const success = index.filter((item) => item && item.success && item.local_path)
  const preferred = success.find(
    (item) => item.title === '调色大师' || String(item.folder || '').includes('调色大师'),
  )
  const rest = preferred ? success.filter((item) => item !== preferred) : success
  return [preferred, ...rest].filter(Boolean).slice(0, limit)
}

async function uploadCover(supabase, authorId, sourceId, coverPath) {
  const buf = await readFile(coverPath)
  const objectPath = `covers/${authorId}/qimeng-preview-${sourceId}.jpg`
  const { error } = await supabase.storage.from('project-images').upload(objectPath, buf, {
    contentType: 'image/jpeg',
    cacheControl: '86400',
    upsert: true,
  })
  if (error) throw new Error(`Cover upload failed for ${sourceId}: ${error.message}`)
  const { data } = supabase.storage.from('project-images').getPublicUrl(objectPath)
  return data.publicUrl
}

async function uploadVideo(oss, folder, videoPath) {
  const key = `${OSS_PREFIX}/${folder}/video_1.mp4`.replace(/\/+/g, '/')
  const headers = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': 'video/mp4',
  }
  await oss.put(key, videoPath, { headers, timeout: 180_000 })
  const base = assetsBaseUrl()
  if (!base) throw new Error('NEXT_PUBLIC_ASSETS_BASE_URL required for video public URL')
  return `${base}/${key}`
}

async function findExisting(supabase, sourceId, title) {
  const tag = sourceTag(sourceId)
  const byTag = await supabase
    .from('projects')
    .select('id,title,status,tags,image_url')
    .contains('tags', [tag])
    .limit(5)
  if (byTag.error) throw byTag.error
  if (byTag.data?.length) return byTag.data[0]

  const titles = Array.from(new Set([title, `${TITLE_PREFIX}${title}`].filter(Boolean)))
  for (const candidate of titles) {
    const byTitle = await supabase
      .from('projects')
      .select('id,title,status,tags,image_url')
      .eq('title', candidate)
      .contains('tags', [TAG_SOURCE])
      .limit(5)
    if (byTitle.error) throw byTitle.error
    if (byTitle.data?.length) return byTitle.data[0]
  }
  return null
}

async function insertProject(supabase, payload) {
  const { materials, steps, ...project } = payload
  const { data: row, error } = await supabase
    .from('projects')
    .insert(project)
    .select('id,title,status,moderation_state,image_url,tags')
    .single()
  if (error) throw error

  if (materials.length) {
    const { error: matErr } = await supabase.from('project_materials').insert(
      materials.map((material, index) => ({
        project_id: row.id,
        material,
        sort_order: index,
      })),
    )
    if (matErr) {
      await supabase.from('projects').delete().eq('id', row.id)
      throw matErr
    }
  }

  if (steps.length) {
    const { error: stepErr } = await supabase.from('project_steps').insert(
      steps.map((step, index) => ({
        project_id: row.id,
        title: step.title,
        description: step.description || null,
        image_url: null,
        sort_order: step.sort_order ?? index,
      })),
    )
    if (stepErr) {
      await supabase.from('project_materials').delete().eq('project_id', row.id)
      await supabase.from('projects').delete().eq('id', row.id)
      throw stepErr
    }
  }

  return row
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

function enrichEntry(entry, { appUrl, category }) {
  entry.category = category
  entry.exploreUrl = entry.projectId ? `${appUrl}/project/${entry.projectId}` : null
  entry.status = entry.ok ? (entry.skipped ? 'skipped' : 'success') : 'fail'
  return entry
}

function buildCsv(results) {
  const headers = [
    'source_id',
    'title',
    'category',
    'local_path',
    'folder',
    'oss_cover_url',
    'oss_video_url',
    'project_id',
    'explore_url',
    'status',
    'classification',
    'error',
  ]
  const lines = [headers.join(',')]
  for (const r of results) {
    lines.push(
      [
        r.sourceId,
        r.title,
        r.category,
        r.localPath,
        r.folder,
        r.imageUrl,
        r.videoUrl,
        r.projectId,
        r.exploreUrl,
        r.status,
        r.classification || '',
        r.error || '',
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

async function writeReports({ sourceRoot, results, reportMeta, stamp }) {
  const scriptReportDir = path.join(ROOT, 'scripts', '.import-reports')
  const sourceReportDir = path.join(sourceRoot, '_import_report')
  await mkdir(scriptReportDir, { recursive: true })
  await mkdir(sourceReportDir, { recursive: true })

  const jsonName = `qimeng-full-${stamp}.json`
  const csvName = `qimeng-full-${stamp}.csv`
  const progressName = 'qimeng-full-progress.json'
  const latestJson = 'qimeng-full-latest.json'
  const latestCsv = 'qimeng-full-latest.csv'

  const jsonBody = JSON.stringify(reportMeta, null, 2)
  const csvBody = buildCsv(results)

  const targets = [scriptReportDir, sourceReportDir]
  for (const dir of targets) {
    await writeFile(path.join(dir, jsonName), jsonBody)
    await writeFile(path.join(dir, csvName), csvBody)
    await writeFile(path.join(dir, latestJson), jsonBody)
    await writeFile(path.join(dir, latestCsv), csvBody)
    await writeFile(
      path.join(dir, progressName),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          done: results.length,
          counts: reportMeta.counts,
          last: results[results.length - 1] || null,
        },
        null,
        2,
      ),
    )
  }

  return {
    json: path.join(scriptReportDir, jsonName),
    csv: path.join(scriptReportDir, csvName),
    sourceJson: path.join(sourceReportDir, jsonName),
    sourceCsv: path.join(sourceReportDir, csvName),
    progress: path.join(scriptReportDir, progressName),
  }
}

async function writeProgressPartial({ sourceRoot, results, appUrl, args, total }) {
  const imported = results.filter((r) => r.ok && !r.skipped && r.projectId)
  const skipped = results.filter((r) => r.skipped)
  const failed = results.filter((r) => !r.ok)
  const reportMeta = {
    at: new Date().toISOString(),
    partial: true,
    appUrl,
    dryRun: args.dryRun,
    limit: args.limit,
    source: args.source,
    totalPlanned: total,
    counts: {
      attempted: results.length,
      imported: imported.length,
      skipped: skipped.length,
      failed: failed.length,
      remaining: Math.max(0, total - results.length),
    },
    results,
  }
  const stamp = `partial-${Date.now()}`
  return writeReports({ sourceRoot: args.source, results, reportMeta, stamp })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await loadEnv()

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const authorId = requireEnv('SUPPORT_USER_ID')
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://dev.steamx.cc').replace(/\/+$/, '')

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const index = await loadIndex(args.source)
  const batch = pickBatch(index, args.limit)
  if (batch.length === 0) {
    console.error('No successful items found in index')
    process.exit(1)
  }

  let oss = null
  if (!args.skipVideo && !args.dryRun) {
    try {
      oss = createOssClient()
    } catch (err) {
      console.warn(`OSS unavailable (${err.message}); continuing without video upload`)
    }
  }

  console.log(`Source: ${args.source}`)
  console.log(`Author: ${authorId}`)
  console.log(`Limit: ${args.limit} | dryRun=${args.dryRun} | skipVideo=${args.skipVideo}`)
  console.log(`Batch size: ${batch.length}`)
  console.log(`OSS prefix: ${OSS_PREFIX}/ → ${assetsBaseUrl() || '(no assets base)'}/${OSS_PREFIX}/...`)

  const results = []
  const startedAt = Date.now()
  let reportPaths = null

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i]
    const localPath = item.local_path
    const folder = item.folder || path.basename(localPath)
    const sourceId = String(item.id)
    const metaPath = path.join(localPath, 'metadata.json')
    const contentPath = path.join(localPath, 'content.txt')
    const coverPath = path.join(localPath, 'media', 'cover.jpeg')
    const videoPath = path.join(localPath, 'media', 'video_1.mp4')

    const entry = {
      sourceId,
      title: item.title,
      folder,
      localPath,
      category: CATEGORY,
      ok: false,
      skipped: false,
      projectId: null,
      imageUrl: null,
      videoUrl: null,
      exploreUrl: null,
      status: 'fail',
      classification: null,
      error: null,
    }

    try {
      if (!(await exists(metaPath)) || !(await exists(contentPath))) {
        throw new Error('missing metadata.json or content.txt')
      }
      const metadata = JSON.parse(await readFile(metaPath, 'utf8'))
      const contentText = await readFile(contentPath, 'utf8')
      const parsed = parseContentTxt(contentText)
      const rawTitle = (metadata.title || item.title || '').trim()
      const title = rawTitle
      if (!title) throw new Error('empty title')
      entry.title = rawTitle

      const existing = await findExisting(supabase, sourceId, rawTitle)
      if (existing && !args.force) {
        entry.ok = true
        entry.skipped = true
        entry.projectId = existing.id
        entry.imageUrl = existing.image_url || null
        entry.videoUrl = expectedVideoUrl(folder)
        enrichEntry(entry, { appUrl, category: CATEGORY })
        results.push(entry)
        console.log(`[${i + 1}/${batch.length}] SKIP existing #${existing.id} ${existing.title}`)
        if ((i + 1) % PROGRESS_EVERY === 0 || i === batch.length - 1) {
          reportPaths = await writeProgressPartial({
            sourceRoot: args.source,
            results,
            appUrl,
            args,
            total: batch.length,
          })
          console.log(`  progress → ${reportPaths.progress}`)
        }
        continue
      }

      let imageUrl = null
      let videoUrl = null

      if (args.dryRun) {
        imageUrl = `(dry-run) covers/${authorId}/qimeng-preview-${sourceId}.jpg`
        if (!args.skipVideo && (await exists(videoPath))) {
          videoUrl = expectedVideoUrl(folder)
        }
      } else {
        if (await exists(coverPath)) {
          imageUrl = await uploadCover(supabase, authorId, sourceId, coverPath)
        }
        if (!args.skipVideo && oss && (await exists(videoPath))) {
          try {
            videoUrl = await uploadVideo(oss, folder, videoPath)
          } catch (videoErr) {
            console.warn(`  video upload failed for ${folder}: ${videoErr.message}`)
          }
        }
      }

      const description = buildDescription({
        principle: parsed.principle,
        digest: metadata.digest,
      })
      const principleText = (parsed.principle || '').trim()
      const reflection = principleText && !isDuplicateQimengReflection(principleText, description)
        ? principleText.slice(0, 5000)
        : null

      const tags = [
        TAG_SOURCE,
        sourceTag(sourceId),
        '科学实验',
        '幼儿科学',
      ]

      const projectPayload = {
        title,
        description,
        video_url: videoUrl,
        category: CATEGORY,
        sub_category_id: null,
        difficulty: 'easy',
        difficulty_stars: 1,
        image_url: imageUrl,
        author_id: authorId,
        status: 'approved',
        moderation_state: 'approved',
        tags,
        reflection,
        problem_statement: `sourceId=${sourceId}; folder=${folder}`.slice(0, 5000),
        steam_weights: { S: 40, T: 5, E: 10, A: 10, M: 5 },
        // Age/support/difficulty reviewed via review_content_classification RPC
        // (direct classification_* writes are blocked by CLASSIFICATION_WRITE_FORBIDDEN).
        materials: qimengMaterialsOrFallback(parsed.materials),
        steps: qimengStepsOrFallback(parsed.steps),
      }

      if (args.dryRun) {
        entry.ok = true
        entry.projectId = null
        entry.imageUrl = imageUrl
        entry.videoUrl = videoUrl
        entry.materials = projectPayload.materials.length
        entry.steps = projectPayload.steps.length
        entry.descriptionLength = description.length
        enrichEntry(entry, { appUrl, category: CATEGORY })
        console.log(
          `[${i + 1}/${batch.length}] DRY ${title} materials=${entry.materials} steps=${entry.steps} video=${Boolean(videoUrl)}`,
        )
      } else {
        const row = await insertProject(supabase, projectPayload)
        const { data: revisionRow, error: revErr } = await supabase
          .from('projects')
          .select('classification_revision')
          .eq('id', row.id)
          .single()
        if (revErr) throw revErr

        try {
          // PostgREST service_role JWT claim is not always visible to
          // review_content_classification(); pg/query + set_config works.
          await reviewProjectClassification({
            projectId: row.id,
            expectedRevision: revisionRow?.classification_revision ?? 0,
            reviewerId: authorId,
          })
          entry.classification = 'reviewed'
        } catch (reviewErr) {
          console.warn(`  classification review failed for #${row.id}: ${reviewErr.message}`)
          entry.classification = 'unreviewed'
        }

        entry.ok = true
        entry.projectId = row.id
        entry.imageUrl = imageUrl
        entry.videoUrl = videoUrl
        enrichEntry(entry, { appUrl, category: CATEGORY })
        console.log(
          `[${i + 1}/${batch.length}] OK #${row.id} ${row.title} classification=${entry.classification}`,
        )
      }
    } catch (err) {
      entry.error = err?.message || String(err)
      enrichEntry(entry, { appUrl, category: CATEGORY })
      console.error(`[${i + 1}/${batch.length}] FAIL ${item.title}: ${entry.error}`)
    }

    results.push(entry)

    if ((i + 1) % PROGRESS_EVERY === 0 || i === batch.length - 1) {
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)
      reportPaths = await writeProgressPartial({
        sourceRoot: args.source,
        results,
        appUrl,
        args,
        total: batch.length,
      })
      console.log(`  progress ${i + 1}/${batch.length} in ${elapsedSec}s → ${reportPaths.progress}`)
    }
  }

  const imported = results.filter((r) => r.ok && !r.skipped && r.projectId)
  const skipped = results.filter((r) => r.skipped)
  const failed = results.filter((r) => !r.ok)
  const stamp = Date.now()

  const report = {
    at: new Date().toISOString(),
    partial: false,
    appUrl,
    dryRun: args.dryRun,
    limit: args.limit,
    source: args.source,
    ossPrefix: `${OSS_PREFIX}/`,
    assetsBase: assetsBaseUrl(),
    elapsedMs: Date.now() - startedAt,
    counts: {
      attempted: results.length,
      imported: imported.length,
      skipped: skipped.length,
      failed: failed.length,
      successOrSkipped: imported.length + skipped.length,
    },
    projectIds: [...skipped, ...imported].map((r) => r.projectId).filter(Boolean),
    results,
    tips: {
      exploreSearch: `${appUrl}/explore?q=${encodeURIComponent('启蒙版')}`,
      exploreTags: `${appUrl}/explore?tags=${encodeURIComponent(TAG_SOURCE)}`,
      projectLinks: [...skipped, ...imported].slice(0, 5).map((r) => `${appUrl}/project/${r.projectId}`),
    },
  }

  reportPaths = await writeReports({
    sourceRoot: args.source,
    results,
    reportMeta: report,
    stamp,
  })

  console.log('\n=== Summary ===')
  console.log(JSON.stringify(report.counts, null, 2))
  console.log('Project IDs count:', report.projectIds.length)
  console.log('JSON report:', reportPaths.json)
  console.log('CSV report:', reportPaths.csv)
  console.log('Source JSON:', reportPaths.sourceJson)
  console.log('Source CSV:', reportPaths.sourceCsv)
  console.log('Explore:', report.tips.exploreSearch)
  if (failed.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
