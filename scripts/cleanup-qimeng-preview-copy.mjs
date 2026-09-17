#!/usr/bin/env node
/**
 * Strip leftover 启蒙版 preview-batch chrome from existing explore rows.
 *
 * Usage:
 *   node scripts/cleanup-qimeng-preview-copy.mjs
 *   node scripts/cleanup-qimeng-preview-copy.mjs --dry-run
 *
 * Removes 【预览】 titles, the 预览 tag, description/step video-URL boilerplate,
 * and duplicate reflections. Keeps 启蒙版 + qimeng-src:* tags in the database.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applyQimengPreviewCopyCleanup,
  cleanQimengStepDescription,
  sameStringArray,
  TAG_PREVIEW,
  TAG_SOURCE,
} from './lib/qimeng-preview-copy.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') }
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await loadEnv()

  const projects = await pgQuery(`
SELECT id, title, description, reflection, tags, problem_statement, video_url
FROM public.projects
WHERE tags @> ARRAY[${sqlLiteral(TAG_SOURCE)}]::text[]
   OR tags @> ARRAY[${sqlLiteral(TAG_PREVIEW)}]::text[]
ORDER BY id;
`)
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

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
