#!/usr/bin/env node
/**
 * Strip leftover 启蒙版 preview-batch chrome from existing explore rows.
 * With --rehydrate, re-read zwlhome-save content.txt and replace description /
 * materials / steps from the parser (not metadata.digest mash).
 *
 * Usage:
 *   node scripts/cleanup-qimeng-preview-copy.mjs
 *   node scripts/cleanup-qimeng-preview-copy.mjs --dry-run
 *   node scripts/cleanup-qimeng-preview-copy.mjs --rehydrate
 *   node scripts/cleanup-qimeng-preview-copy.mjs --rehydrate --dry-run
 *   node scripts/cleanup-qimeng-preview-copy.mjs --rehydrate --source=/path/to/启蒙版
 *
 * Removes 【预览】 titles, the 预览 tag, description/step video-URL boilerplate,
 * and duplicate reflections. Keeps 启蒙版 + qimeng-src:* tags in the database.
 */

import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applyQimengPreviewCopyCleanup,
  buildQimengDescription,
  cleanQimengStepDescription,
  isDuplicateQimengReflection,
  parseQimengContentTxt,
  qimengMaterialsOrFallback,
  qimengSourceIdFromTags,
  qimengStepsOrFallback,
  sameStringArray,
  TAG_PREVIEW,
  TAG_SOURCE,
} from './lib/qimeng-preview-copy.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DEFAULT_SOURCE = '/workspace/zwlhome-save/启蒙版'

function parseArgs(argv) {
  const args = {
    dryRun: false,
    rehydrate: false,
    source: DEFAULT_SOURCE,
  }
  for (const token of argv) {
    if (token === '--dry-run') args.dryRun = true
    else if (token === '--rehydrate') args.rehydrate = true
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

function sqlLiteral(value) {
  if (value == null) return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
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

/** Writes go through PostgREST; pg/query UPDATE hits enforce_interaction_access. */
async function restPatch(table, id, patch) {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${Number(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })
  if (!response.ok) {
    throw new Error(`REST PATCH ${table} #${id} HTTP ${response.status}: ${await response.text()}`)
  }
}

function projectPatch(row) {
  const cleaned = applyQimengPreviewCopyCleanup({
    title: row.title,
    description: row.description,
    reflection: row.reflection,
    tags: row.tags,
    problem_statement: row.problem_statement,
  })
  const nextReflection = cleaned.reflection || null
  const nextProblem = cleaned.problem_statement || null
  const patch = {}
  if (cleaned.title !== (row.title || '')) patch.title = cleaned.title
  if (cleaned.description !== (row.description || '')) patch.description = cleaned.description
  if (nextReflection !== (row.reflection || null)) patch.reflection = nextReflection
  if (!sameStringArray(cleaned.tags, row.tags || [])) patch.tags = cleaned.tags
  if (nextProblem !== (row.problem_statement || null)) patch.problem_statement = nextProblem
  return patch
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function sourceIdFromProblem(problem) {
  const match = String(problem || '').match(/sourceId=([^;]+)/)
  return match ? match[1].trim() : null
}

function folderFromProblem(problem) {
  const match = String(problem || '').match(/folder=([^;]+)/)
  return match ? match[1].trim() : null
}

async function loadSourceIndex(sourceRoot) {
  const indexPath = path.join(sourceRoot, 'index.json')
  const raw = JSON.parse(await readFile(indexPath, 'utf8'))
  if (!Array.isArray(raw)) throw new Error('index.json must be an array')
  const byId = new Map()
  const byFolder = new Map()
  const byTitle = new Map()
  for (const item of raw) {
    if (!item) continue
    if (item.id != null) byId.set(String(item.id), item)
    if (item.folder) byFolder.set(String(item.folder), item)
    const title = String(item.title || '').trim()
    if (title && !byTitle.has(title)) byTitle.set(title, item)
  }
  return { byId, byFolder, byTitle }
}

function resolveIndexItem(row, index) {
  const sourceId = qimengSourceIdFromTags(row.tags) || sourceIdFromProblem(row.problem_statement)
  if (sourceId && index.byId.has(sourceId)) return index.byId.get(sourceId)
  const folder = folderFromProblem(row.problem_statement)
  if (folder && index.byFolder.has(folder)) return index.byFolder.get(folder)
  const title = String(row.title || '').replace(/^【预览】/, '').trim()
  if (title && index.byTitle.has(title)) return index.byTitle.get(title)
  return null
}

async function resolveContentPath(item, sourceRoot) {
  const candidates = []
  if (item?.local_path) candidates.push(path.join(item.local_path, 'content.txt'))
  if (item?.type && item?.folder) {
    candidates.push(path.join(sourceRoot, item.type, item.folder, 'content.txt'))
  }
  if (item?.folder) {
    for (const bucket of ['1-100', '101-200', '201-248']) {
      candidates.push(path.join(sourceRoot, bucket, item.folder, 'content.txt'))
    }
  }
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate
  }
  return null
}

function sameSteps(left, right) {
  if (left.length !== right.length) return false
  return left.every((step, index) => {
    const other = right[index]
    return (
      (step.title || '') === (other.title || '') &&
      (step.description || '') === (other.description || '')
    )
  })
}

async function restInsert(table, rows) {
  if (!rows.length) return
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!response.ok) {
    throw new Error(`REST POST ${table} HTTP ${response.status}: ${await response.text()}`)
  }
}

async function restDeleteByProject(table, projectId) {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(`${url}/rest/v1/${table}?project_id=eq.${Number(projectId)}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=minimal',
    },
  })
  if (!response.ok) {
    throw new Error(`REST DELETE ${table} project ${projectId} HTTP ${response.status}: ${await response.text()}`)
  }
}

async function fetchProjectChildren(projectIds) {
  if (!projectIds.length) return { materials: [], steps: [] }
  const idList = projectIds.join(', ')
  const [materials, steps] = await Promise.all([
    pgQuery(`
SELECT id, project_id, material, sort_order
FROM public.project_materials
WHERE project_id IN (${idList})
ORDER BY project_id, sort_order, id;
`),
    pgQuery(`
SELECT id, project_id, title, description, sort_order
FROM public.project_steps
WHERE project_id IN (${idList})
ORDER BY project_id, sort_order, id;
`),
  ])
  return { materials: materials || [], steps: steps || [] }
}

function groupByProject(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const list = map.get(row.project_id) || []
    list.push(row)
    map.set(row.project_id, list)
  }
  return map
}

async function runChromeCleanup(args, projects) {
  const projectIds = (projects || []).map((row) => Number(row.id))
  const steps = projectIds.length
    ? await pgQuery(`
SELECT id, project_id, description
FROM public.project_steps
WHERE project_id IN (${projectIds.join(', ')})
ORDER BY id;
`)
    : []

  const stepsByProject = new Map()
  for (const step of steps || []) {
    const list = stepsByProject.get(step.project_id) || []
    list.push(step)
    stepsByProject.set(step.project_id, list)
  }

  const projectUpdates = []
  const stepUpdates = []
  const samples = []

  for (const row of projects || []) {
    const patch = projectPatch(row)
    const nextSteps = []
    for (const step of stepsByProject.get(row.id) || []) {
      const nextDescription = cleanQimengStepDescription(step.description) || null
      if (nextDescription !== (step.description || null)) {
        nextSteps.push({ id: step.id, description: nextDescription })
      }
    }
    if (Object.keys(patch).length === 0 && nextSteps.length === 0) continue
    projectUpdates.push({ id: row.id, patch })
    stepUpdates.push(...nextSteps)
    if (samples.length < 8) {
      samples.push({
        id: row.id,
        title: patch.title ?? row.title,
        tags: patch.tags ?? row.tags,
        description: (patch.description ?? row.description ?? '').slice(0, 120),
        reflection: patch.reflection === undefined ? row.reflection : patch.reflection,
        steps: nextSteps.length,
      })
    }
  }

  const summary = {
    dryRun: args.dryRun,
    scanned: (projects || []).length,
    projectsToUpdate: projectUpdates.length,
    stepsToUpdate: stepUpdates.length,
    samples,
  }
  console.log(JSON.stringify(summary, null, 2))

  if (args.dryRun) {
    console.log(`Dry-run: would update ${projectUpdates.length} projects and ${stepUpdates.length} steps.`)
    return
  }

  for (const { id, patch } of projectUpdates) {
    if (Object.keys(patch).length === 0) continue
    await restPatch('projects', id, patch)
  }
  for (const { id, description } of stepUpdates) {
    await restPatch('project_steps', id, { description })
  }

  console.log(`Updated ${projectUpdates.length} projects and ${stepUpdates.length} steps.`)
}

async function runRehydrate(args, projects) {
  const index = await loadSourceIndex(args.source)
  const projectIds = (projects || []).map((row) => Number(row.id))
  const { materials, steps } = await fetchProjectChildren(projectIds)
  const materialsByProject = groupByProject(materials)
  const stepsByProject = groupByProject(steps)

  const planned = []
  const skipped = []
  const failed = []

  for (const row of projects || []) {
    try {
      const item = resolveIndexItem(row, index)
      if (!item) {
        skipped.push({ id: row.id, title: row.title, reason: 'no-source-mapping' })
        continue
      }
      const contentPath = await resolveContentPath(item, args.source)
      if (!contentPath) {
        skipped.push({ id: row.id, title: row.title, reason: 'missing-content-txt', folder: item.folder })
        continue
      }

      const contentText = await readFile(contentPath, 'utf8')
      const parsed = parseQimengContentTxt(contentText)
      const description = buildQimengDescription({ principle: parsed.principle })
      const nextMaterials = qimengMaterialsOrFallback(parsed.materials)
      const nextSteps = qimengStepsOrFallback(parsed.steps)
      const chrome = applyQimengPreviewCopyCleanup({
        title: row.title,
        description,
        reflection: parsed.principle,
        tags: row.tags,
        problem_statement: row.problem_statement,
      })
      let nextReflection = chrome.reflection || null
      if (isDuplicateQimengReflection(nextReflection, description)) nextReflection = null

      const patch = {}
      if (chrome.title !== (row.title || '')) patch.title = chrome.title
      if (description !== (row.description || '')) patch.description = description
      if (nextReflection !== (row.reflection || null)) patch.reflection = nextReflection
      if (!sameStringArray(chrome.tags, row.tags || [])) patch.tags = chrome.tags
      if ((chrome.problem_statement || null) !== (row.problem_statement || null)) {
        patch.problem_statement = chrome.problem_statement || null
      }

      const currentMaterials = (materialsByProject.get(row.id) || []).map((item) => item.material)
      const currentSteps = (stepsByProject.get(row.id) || []).map((item) => ({
        title: item.title || '',
        description: item.description || '',
      }))
      const replaceMaterials = !sameStringArray(currentMaterials, nextMaterials)
      const replaceSteps = !sameSteps(currentSteps, nextSteps)

      if (Object.keys(patch).length === 0 && !replaceMaterials && !replaceSteps) {
        skipped.push({ id: row.id, title: row.title, reason: 'unchanged' })
        continue
      }

      planned.push({
        id: row.id,
        title: chrome.title || row.title,
        sourceId: String(item.id),
        folder: item.folder || null,
        patch,
        replaceMaterials,
        replaceSteps,
        materials: nextMaterials,
        steps: nextSteps,
        materialsCount: nextMaterials.length,
        stepsCount: nextSteps.length,
      })
    } catch (err) {
      failed.push({ id: row.id, title: row.title, error: err?.message || String(err) })
    }
  }

  const sample711 = planned.find((item) => Number(item.id) === 711) || null
  const summary = {
    dryRun: args.dryRun,
    rehydrate: true,
    source: args.source,
    scanned: (projects || []).length,
    projectsToUpdate: planned.length,
    materialsReplaced: planned.filter((item) => item.replaceMaterials).length,
    stepsReplaced: planned.filter((item) => item.replaceSteps).length,
    skipped: skipped.length,
    failed: failed.length,
    skippedReasons: skipped.reduce((acc, item) => {
      acc[item.reason] = (acc[item.reason] || 0) + 1
      return acc
    }, {}),
    sample711: sample711
      ? {
          id: sample711.id,
          title: sample711.title,
          description: sample711.patch.description?.slice(0, 180) ?? '(unchanged)',
          materials: sample711.materials,
          steps: sample711.steps.map((step) => ({ title: step.title, description: step.description.slice(0, 80) })),
        }
      : null,
    failedSamples: failed.slice(0, 8),
  }
  console.log(JSON.stringify(summary, null, 2))

  if (args.dryRun) {
    console.log(`Dry-run: would rehydrate ${planned.length} projects.`)
    return summary
  }

  let updated = 0
  for (const item of planned) {
    if (Object.keys(item.patch).length) {
      await restPatch('projects', item.id, item.patch)
    }
    if (item.replaceMaterials) {
      await restDeleteByProject('project_materials', item.id)
      await restInsert(
        'project_materials',
        item.materials.map((material, index) => ({
          project_id: item.id,
          material,
          sort_order: index,
        })),
      )
    }
    if (item.replaceSteps) {
      await restDeleteByProject('project_steps', item.id)
      await restInsert(
        'project_steps',
        item.steps.map((step, index) => ({
          project_id: item.id,
          title: step.title,
          description: step.description || null,
          image_url: null,
          sort_order: step.sort_order ?? index,
        })),
      )
    }
    updated += 1
    if (updated % 25 === 0 || updated === planned.length) {
      console.log(`  wrote ${updated}/${planned.length}`)
    }
  }

  console.log(`Rehydrated ${updated} projects (${summary.materialsReplaced} materials, ${summary.stepsReplaced} steps).`)
  if (failed.length) process.exitCode = 1
  return { ...summary, updated }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await loadEnv()

  const projects = await pgQuery(`
SELECT id, title, description, reflection, tags, problem_statement, video_url
FROM public.projects
WHERE tags @> ARRAY[${sqlLiteral(TAG_SOURCE)}]::text[]
   OR tags @> ARRAY[${sqlLiteral(TAG_PREVIEW)}]::text[]
   OR EXISTS (
     SELECT 1
     FROM unnest(COALESCE(tags, ARRAY[]::text[])) AS tag
     WHERE tag ILIKE 'qimeng-src:%'
   )
ORDER BY id;
`)

  if (args.rehydrate) {
    await runRehydrate(args, projects || [])
    return
  }

  await runChromeCleanup(args, projects || [])
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
