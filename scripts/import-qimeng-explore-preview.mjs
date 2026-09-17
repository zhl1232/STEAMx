#!/usr/bin/env node
/**
 * Import a small preview batch of 启蒙版 partner experiments into STEAMx explore projects.
 *
 * Usage:
 *   node scripts/import-qimeng-explore-preview.mjs --limit=10
 *   node scripts/import-qimeng-explore-preview.mjs --limit=10 --dry-run
 *   node scripts/import-qimeng-explore-preview.mjs --source=/path/to/启蒙版 --limit=10
 *
 * Requires .env.local (or env):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPPORT_USER_ID
 *   ALIYUN_OSS_* (+ NEXT_PUBLIC_ASSETS_BASE_URL for video HTTPS links)
 *
 * Does NOT print secrets. Idempotent via tag `qimeng-src:{sourceId}`.
 *
 * Videos upload to OSS under qimeng-preview/ and the HTTPS CDN URL is written into
 * description + first step. Projects have no video_url column, so detail pages do not
 * embed a player. CDN may require site Referer (hotlink protection).
 */

import { readFile, access, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createOssClient } from '../lib/utils/oss-client.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DEFAULT_SOURCE = '/workspace/zwlhome-save/启蒙版'

const TAG_SOURCE = '启蒙版'
const TAG_PREVIEW = '预览'
const DESC_PREFIX = '【启蒙版·预览】'
const TITLE_PREFIX = '【预览】'
const CATEGORY = '科学'
const OSS_PREFIX = 'qimeng-preview'

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

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function parseContentTxt(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim()
  let materialsLine = ''
  let principle = ''
  const steps = []

  const materialsMatch = normalized.match(/实验材料[：:]\s*(.+?)(?:\n|$)/)
  if (materialsMatch) materialsLine = materialsMatch[1].trim()

  const principleMatch = normalized.match(/科学原理[：:]\s*([\s\S]+)$/)
  if (principleMatch) principle = principleMatch[1].trim()

  const stepsBlockMatch = normalized.match(/实验步骤[：:]\s*\n([\s\S]*?)(?=\n科学原理[：:]|$)/)
  const stepsBlock = stepsBlockMatch ? stepsBlockMatch[1] : ''
  const stepRegex = /^\s*(\d+)[、.．]\s*(.+)$/gm
  let m
  while ((m = stepRegex.exec(stepsBlock)) !== null) {
    const body = m[2].trim()
    if (body) {
      steps.push({
        title: `步骤 ${m[1]}`,
        description: body.slice(0, 1000),
        sort_order: Number(m[1]) - 1,
      })
    }
  }

  // Fallback: sometimes steps are inline after 实验步骤：
  if (steps.length === 0) {
    const inline = normalized.match(/实验步骤[：:]\s*(.+?)(?:科学原理[：:]|$)/s)
    if (inline) {
      const inlineRegex = /(\d+)[、.．]\s*([^0-9]+?)(?=\d+[、.．]|科学原理|$)/g
      let im
      while ((im = inlineRegex.exec(inline[1])) !== null) {
        const body = im[2].trim()
        if (body) {
          steps.push({
            title: `步骤 ${im[1]}`,
            description: body.slice(0, 1000),
            sort_order: Number(im[1]) - 1,
          })
        }
      }
    }
  }

  const materials = materialsLine
    .split(/[、,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, 200))
    .slice(0, 50)

  return { materials, steps, principle, materialsLine }
}

function buildDescription({ principle, digest, videoUrl, sourceUrl }) {
  const parts = [DESC_PREFIX]
  const science = (principle || '').trim()
  const summary = (digest || '').trim()
  if (science) {
    parts.push(`科学原理：${science}`)
  } else if (summary) {
    parts.push(summary)
  } else {
    parts.push('启蒙版合作实验预览条目，材料与步骤见正文。')
  }
  if (videoUrl) {
    parts.push(`演示视频（外链）：${videoUrl}`)
  } else {
    parts.push('演示视频：本次预览未挂载可播视频（详情页暂无 video 字段）。')
  }
  if (sourceUrl) {
    parts.push(`来源：伙伴启蒙版实验（预览导入，可搜索标签「${TAG_PREVIEW}」「${TAG_SOURCE}」后删除）。`)
  }
  let text = parts.join('\n')
  if (text.length > 2000) text = `${text.slice(0, 1997)}...`
  return text
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
    .select('id,title,status,tags')
    .contains('tags', [tag])
    .limit(5)
  if (byTag.error) throw byTag.error
  if (byTag.data?.length) return byTag.data[0]

  const previewTitle = `${TITLE_PREFIX}${title}`
  const byTitle = await supabase
    .from('projects')
    .select('id,title,status,tags')
    .eq('title', previewTitle)
    .contains('tags', [TAG_SOURCE, TAG_PREVIEW])
    .limit(5)
  if (byTitle.error) throw byTitle.error
  return byTitle.data?.[0] || null
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
  console.log(`Batch: ${batch.map((b) => b.title).join('、')}`)

  const results = []
  for (const item of batch) {
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
      ok: false,
      skipped: false,
      projectId: null,
      imageUrl: null,
      videoUrl: null,
      error: null,
    }

    try {
      if (!(await exists(metaPath)) || !(await exists(contentPath))) {
        throw new Error('missing metadata.json or content.txt')
      }
      const metadata = JSON.parse(await readFile(metaPath, 'utf8'))
      const contentText = await readFile(contentPath, 'utf8')
      const parsed = parseContentTxt(contentText)
      const title = `${TITLE_PREFIX}${(metadata.title || item.title || '').trim()}`
      if (!title || title === TITLE_PREFIX) throw new Error('empty title')

      const existing = await findExisting(supabase, sourceId, metadata.title || item.title)
      if (existing && !args.force) {
        entry.ok = true
        entry.skipped = true
        entry.projectId = existing.id
        entry.note = 'already imported'
        results.push(entry)
        console.log(`SKIP existing #${existing.id} ${existing.title}`)
        continue
      }

      let imageUrl = null
      let videoUrl = null

      if (args.dryRun) {
        imageUrl = `(dry-run) covers/${authorId}/qimeng-preview-${sourceId}.jpg`
        if (!args.skipVideo && (await exists(videoPath))) {
          videoUrl = `${assetsBaseUrl() || 'https://assets.example'}/${OSS_PREFIX}/${folder}/video_1.mp4`
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
        videoUrl,
        sourceUrl: metadata.url || item.url,
      })

      const tags = [
        TAG_SOURCE,
        TAG_PREVIEW,
        sourceTag(sourceId),
        '科学实验',
        '幼儿科学',
      ]

      const projectPayload = {
        title,
        description,
        category: CATEGORY,
        sub_category_id: null,
        difficulty: 'easy',
        difficulty_stars: 1,
        image_url: imageUrl,
        author_id: authorId,
        status: 'approved',
        moderation_state: 'approved',
        tags,
        reflection: parsed.principle
          ? `${DESC_PREFIX}科学原理补充：${parsed.principle}`.slice(0, 5000)
          : null,
        problem_statement: `${DESC_PREFIX}伙伴启蒙版实验预览导入；sourceId=${sourceId}; folder=${folder}`.slice(0, 5000),
        steam_weights: { S: 40, T: 5, E: 10, A: 10, M: 5 },
        // Age/support/difficulty reviewed via review_content_classification RPC
        // (direct classification_* writes are blocked by CLASSIFICATION_WRITE_FORBIDDEN).
        materials: parsed.materials.length ? parsed.materials : ['（见实验说明）'],
        steps: parsed.steps.length
          ? parsed.steps
          : [{ title: '步骤 1', description: '请按材料准备后动手尝试（预览条目步骤解析为空）。', sort_order: 0 }],
      }

      // Put video URL note into first step when present
      if (videoUrl && projectPayload.steps[0]) {
        const note = `【演示视频】${videoUrl}`
        const desc = projectPayload.steps[0].description || ''
        projectPayload.steps[0].description = `${note}\n${desc}`.slice(0, 1000)
      }

      if (args.dryRun) {
        entry.ok = true
        entry.projectId = null
        entry.imageUrl = imageUrl
        entry.videoUrl = videoUrl
        entry.materials = projectPayload.materials.length
        entry.steps = projectPayload.steps.length
        entry.descriptionLength = description.length
        console.log(`DRY ${title} materials=${entry.materials} steps=${entry.steps} video=${Boolean(videoUrl)}`)
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
        console.log(`OK #${row.id} ${row.title} classification=${entry.classification}`)
      }
    } catch (err) {
      entry.error = err?.message || String(err)
      console.error(`FAIL ${item.title}: ${entry.error}`)
    }

    results.push(entry)
  }

  const imported = results.filter((r) => r.ok && !r.skipped && r.projectId)
  const skipped = results.filter((r) => r.skipped)
  const failed = results.filter((r) => !r.ok)

  const report = {
    at: new Date().toISOString(),
    appUrl,
    dryRun: args.dryRun,
    limit: args.limit,
    source: args.source,
    counts: {
      attempted: results.length,
      imported: imported.length,
      skipped: skipped.length,
      failed: failed.length,
    },
    projectIds: imported.map((r) => r.projectId),
    results,
    tips: {
      exploreSearch: `${appUrl}/explore?q=${encodeURIComponent('启蒙版')}`,
      exploreTags: `${appUrl}/explore?tags=${encodeURIComponent(TAG_PREVIEW)}`,
      projectLinks: imported.slice(0, 5).map((r) => `${appUrl}/project/${r.projectId}`),
    },
  }

  const outDir = path.join(ROOT, 'scripts', '.import-reports')
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `qimeng-preview-${Date.now()}.json`)
  await writeFile(outPath, JSON.stringify(report, null, 2))
  console.log('\n=== Summary ===')
  console.log(JSON.stringify(report.counts, null, 2))
  console.log('Project IDs:', report.projectIds.join(', ') || '(none)')
  console.log('Report:', outPath)
  if (failed.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
