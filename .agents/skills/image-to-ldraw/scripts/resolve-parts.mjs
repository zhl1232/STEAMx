#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

import {
  PROJECT_ROOT,
  cachePathForPart,
  fileExists,
  listFilesSafe,
  loadPartMetadata,
  localPartCandidates,
  normalizePartId,
  readJson,
  safeJoin,
  sha256,
} from './ldraw-common.mjs'

const execFileAsync = promisify(execFile)
const MIRROR = 'https://raw.githubusercontent.com/gkjohnson/ldraw-parts-library/master/complete/ldraw'
const SEARCH_DIRS = ['parts', 'p', 'models']

function parseArgs(argv) {
  if (argv.length === 0) throw new Error('usage: resolve-parts.mjs <assembly.json | part.dat...>')
  return { inputs: argv }
}

async function fetchText(url) {
  const { stdout } = await execFileAsync(
    'curl',
    ['-sSL', '-w', '\n%{http_code}', '--max-time', '30', url],
    { maxBuffer: 64 * 1024 * 1024 },
  )
  const idx = stdout.lastIndexOf('\n')
  const body = stdout.slice(0, idx)
  const code = stdout.slice(idx + 1).trim()
  if (code === '404' || code === '400') return null
  if (code !== '200') throw new Error(`HTTP ${code} for ${url}`)
  return body
}

function extractPartIdsFromAssembly(assembly) {
  const ids = new Set()
  for (const step of assembly.steps ?? []) {
    for (const placement of step.placements ?? []) {
      if (placement.partId) ids.add(placement.partId)
    }
  }
  return [...ids]
}

async function extractMpdBlock(partId) {
  const target = normalizePartId(partId)
  const dir = resolve(PROJECT_ROOT, 'public/courses/ldraw')
  const files = (await listFilesSafe(dir)).filter((file) => file.endsWith('.mpd')).sort()

  for (const file of files) {
    const text = await readFile(resolve(dir, file), 'utf8')
    const lines = text.split(/\r?\n/)
    let currentName = null
    let currentLines = []
    for (const line of lines) {
      if (line.startsWith('0 FILE ')) {
        if (currentName && normalizePartId(currentName) === target) {
          return { content: currentLines.join('\n').trimEnd() + '\n', source: resolve(dir, file) }
        }
        currentName = line.slice('0 FILE '.length).trim()
        currentLines = []
      } else if (currentName) {
        currentLines.push(line)
      }
    }
    if (currentName && normalizePartId(currentName) === target) {
      return { content: currentLines.join('\n').trimEnd() + '\n', source: resolve(dir, file) }
    }
  }
  return null
}

async function resolveLocalFile(partId) {
  for (const candidate of localPartCandidates(partId)) {
    if (!fileExists(candidate)) continue
    return { content: await readFile(candidate, 'utf8'), source: candidate, kind: 'local-file' }
  }
  const fromMpd = await extractMpdBlock(partId)
  if (fromMpd) return { ...fromMpd, kind: 'local-mpd' }
  return null
}

async function resolveRemote(partId) {
  const normalized = String(partId).replace(/\\/g, '/')
  for (const dir of SEARCH_DIRS) {
    const url = `${MIRROR}/${dir}/${normalized}`
    const content = await fetchText(url)
    if (content !== null) return { content, source: url, kind: 'remote' }
  }
  return null
}

async function cacheResolvedPart(partId, resolved) {
  const path = cachePathForPart(partId)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, resolved.content, 'utf8')
  await writeFile(`${path}.json`, JSON.stringify({
    partId,
    source: resolved.source,
    kind: resolved.kind,
    sha256: sha256(resolved.content),
  }, null, 2) + '\n', 'utf8')
  return path
}

async function collectPartIds(inputs) {
  if (inputs.length === 1 && inputs[0].endsWith('.json')) {
    return extractPartIdsFromAssembly(await readJson(resolve(PROJECT_ROOT, inputs[0])))
  }
  return inputs
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const partIds = await collectPartIds(args.inputs)
  const { parts } = await loadPartMetadata()
  const results = []
  const errors = []

  for (const partId of partIds) {
    const normalized = normalizePartId(partId)
    if (!parts.has(normalized)) {
      errors.push(`${partId}: missing part-metadata.json entry`)
      continue
    }
    let resolved = await resolveLocalFile(partId)
    if (!resolved) resolved = await resolveRemote(partId)
    if (!resolved) {
      errors.push(`${partId}: not found in local MPDs/custom parts or fixed LDraw mirror`)
      continue
    }
    const cachePath = await cacheResolvedPart(partId, resolved)
    results.push({ partId, kind: resolved.kind, source: resolved.source, cachePath: safeJoin(cachePath) })
  }

  process.stdout.write(JSON.stringify({ resolved: results, errors }, null, 2) + '\n')
  if (errors.length > 0) {
    process.stderr.write(`part resolution failed with ${errors.length} error(s)\n`)
    process.exit(2)
  }
  process.stderr.write(`resolved ${results.length} part(s)\n`)
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exit(1)
})
