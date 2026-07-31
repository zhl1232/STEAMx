#!/usr/bin/env node

/**
 * Build the small, fixed-size images used by the species atlas.
 *
 * The command is read-only by default. Use --write to create local atlas
 * files and update public/manifests/species-atlas-thumbnails.json.
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const MANIFEST_DIR = path.join(PUBLIC_DIR, 'manifests')
const ATLAS_MANIFEST_PATH = path.join(MANIFEST_DIR, 'species-atlas-thumbnails.json')
const TOPICS = ['birds', 'insects', 'plants']
const SOURCE_MANIFESTS = {
  birds: ['birds.json'],
  insects: ['insects.json'],
  plants: ['trees.json', 'fruits.json'],
}
const MAX_BYTES = 24 * 1024
const TARGET_SIZE = 160
const REMOTE_FETCH_TIMEOUT_MS = 10_000
const REMOTE_FETCH_ATTEMPTS = 3
const CANONICAL_ASSET_REFERER = 'https://steamx.cc'

function loadEnv() {
  for (const filename of ['.env.local', '.env']) {
    const filePath = path.join(ROOT, filename)
    if (!existsSync(filePath)) continue

    const content = readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator < 0) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  }
}

function parseArgs(argv) {
  const args = {
    write: false,
    topics: null,
    slugs: null,
    concurrency: 4,
  }

  for (const token of argv) {
    if (token === '--write') args.write = true
    else if (token === '--check') args.write = false
    else if (token.startsWith('--only=')) {
      args.topics = new Set(token.slice('--only='.length).split(',').map((value) => value.trim()).filter(Boolean))
    } else if (token.startsWith('--slug=')) {
      args.slugs = new Set(token.slice('--slug='.length).split(',').map((value) => value.trim()).filter(Boolean))
    } else if (token.startsWith('--concurrency=')) {
      args.concurrency = Math.max(1, Math.min(16, Number(token.slice('--concurrency='.length)) || 4))
    } else if (token === '--help' || token === '-h') {
      console.log('Usage: node scripts/build-species-atlas-thumbnails.mjs [--check|--write] [--only=birds,insects,plants] [--slug=slug-a,slug-b] [--concurrency=4]')
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }

  if (args.topics) {
    const invalid = [...args.topics].filter((topic) => !TOPICS.includes(topic))
    if (invalid.length > 0) throw new Error(`Invalid topics: ${invalid.join(', ')}`)
  }

  return args
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read ${path.relative(ROOT, filePath)}: ${error.message}`)
  }
}

function readSourceManifests() {
  const manifests = new Map()
  for (const topic of TOPICS) {
    const entries = new Map()
    for (const filename of SOURCE_MANIFESTS[topic]) {
      const source = readJson(path.join(MANIFEST_DIR, filename), {})
      for (const [slug, urls] of Object.entries(source)) {
        if (!Array.isArray(urls)) continue
        const current = entries.get(slug) || []
        entries.set(slug, [...current, ...urls.filter((url) => typeof url === 'string')])
      }
    }
    manifests.set(topic, entries)
  }
  return manifests
}

async function fetchSpeciesRows() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const query = new URLSearchParams({
    select: 'id,slug,nature_topic,cover_image_url',
    is_active: 'eq.true',
    nature_topic: 'in.(' + TOPICS.join(',') + ')',
    order: 'slug.asc',
  })
  const response = await fetch(`${supabaseUrl}/rest/v1/species?${query}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`Supabase species query failed: HTTP ${response.status} ${await response.text()}`)
  }
  return await response.json()
}

function resolveLocalSource(source) {
  if (!source?.startsWith('/')) return null
  const filePath = path.join(PUBLIC_DIR, source.replace(/^\/+/, ''))
  return existsSync(filePath) ? filePath : null
}

function resolveRemoteSource(source) {
  if (/^https?:\/\//i.test(source)) return source
  const baseUrl = (process.env.NEXT_PUBLIC_ASSETS_BASE_URL || process.env.ASSETS_BASE_URL || '').replace(/\/+$/, '')
  return baseUrl && source?.startsWith('/') ? `${baseUrl}${source}` : null
}

async function loadSourceBuffer(source, cache) {
  const localPath = resolveLocalSource(source)
  if (localPath) {
    return await fs.readFile(localPath)
  }

  const remoteUrl = resolveRemoteSource(source)
  if (!remoteUrl) return null
  if (cache.has(remoteUrl)) return cache.get(remoteUrl)

  const referers = [
    CANONICAL_ASSET_REFERER,
    process.env.ASSETS_PROXY_REFERER,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter((referer, index, all) => typeof referer === 'string' && referer && all.indexOf(referer) === index)
  const promise = (async () => {
    for (const [index, referer] of referers.entries()) {
      for (let attempt = 1; attempt <= REMOTE_FETCH_ATTEMPTS; attempt += 1) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS)
        try {
          const response = await fetch(remoteUrl, {
            headers: {
              Accept: 'image/*',
              Referer: referer,
              'User-Agent': 'steam-explore-species-atlas/1.0',
            },
            signal: controller.signal,
          })

          if (response.status === 403 && index < referers.length - 1) {
            await response.body?.cancel().catch(() => undefined)
            break
          }
          if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt < REMOTE_FETCH_ATTEMPTS) {
            await response.body?.cancel().catch(() => undefined)
            await new Promise((resolve) => setTimeout(resolve, attempt * 250))
            continue
          }
          if (!response.ok) return null
          const contentType = response.headers.get('content-type') || ''
          if (contentType && !contentType.startsWith('image/')) return null
          return Buffer.from(await response.arrayBuffer())
        } catch (error) {
          if (attempt >= REMOTE_FETCH_ATTEMPTS) throw error
          await new Promise((resolve) => setTimeout(resolve, attempt * 250))
        } finally {
          clearTimeout(timeout)
        }
      }
    }
    return null
  })()
  cache.set(remoteUrl, promise)
  return await promise
}

function outputDirectoryForSource(topic, source) {
  if (topic === 'plants' && source.startsWith('/fruits/')) return 'fruits'
  if (topic === 'plants') return 'trees'
  return topic
}

async function buildThumbnail(row, source, sourceCache) {
  const sourceBuffer = await loadSourceBuffer(source, sourceCache)
  if (!sourceBuffer) return null

  const outputBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: TARGET_SIZE, height: TARGET_SIZE, fit: 'cover' })
    .webp({ quality: 68 })
    .toBuffer()
  const metadata = await sharp(outputBuffer).metadata()
  if (metadata.width !== TARGET_SIZE || metadata.height !== TARGET_SIZE || metadata.format !== 'webp') {
    throw new Error(`Unexpected output metadata for ${row.slug}`)
  }

  const sha256 = crypto.createHash('sha256').update(outputBuffer).digest('hex')
  const outputDirectory = outputDirectoryForSource(row.nature_topic, source)
  const filename = `${row.slug}-${sha256.slice(0, 8)}.webp`

  return {
    item: {
      topicKey: row.nature_topic,
      thumbnailUrl: `/${outputDirectory}/atlas/${filename}`,
      bytes: outputBuffer.byteLength,
      sha256,
    },
    outputBuffer,
    outputPath: path.join(PUBLIC_DIR, outputDirectory, 'atlas', filename),
  }
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)]
}

function selectSpeciesRows(rows, args) {
  return rows
    .filter((row) => (
      TOPICS.includes(row.nature_topic) &&
      (!args.topics || args.topics.has(row.nature_topic)) &&
      (!args.slugs || args.slugs.has(row.slug))
    ))
    .sort((left, right) => left.slug.localeCompare(right.slug) || left.id - right.id)
}

function isSelectedManifestItem(slug, item, args) {
  if (!args.topics && !args.slugs) return true
  if (args.slugs?.has(slug)) return true
  return Boolean(args.topics?.has(item?.topicKey))
}

async function checkExistingManifest(rows, args) {
  const manifest = readJson(ATLAS_MANIFEST_PATH, { schemaVersion: 1, items: {} })
  const items = manifest.items && typeof manifest.items === 'object' ? manifest.items : {}
  const failures = []
  const missing = []
  const sizes = []
  let localFilesMissing = 0

  for (const row of rows) {
    const item = items[row.slug]
    if (!item) {
      missing.push(row.slug)
      continue
    }

    const isValidUrl = typeof item.thumbnailUrl === 'string'
      && /^\/(birds|insects|trees|fruits)\/atlas\/[^/]+\.webp$/.test(item.thumbnailUrl)
    const isValidMetadata = item.topicKey === row.nature_topic
      && Number.isInteger(item.bytes)
      && item.bytes > 0
      && typeof item.sha256 === 'string'
      && /^[a-f0-9]{64}$/.test(item.sha256)
    if (!isValidUrl || !isValidMetadata) {
      failures.push(`${row.slug}: invalid manifest entry`)
      continue
    }

    sizes.push(item.bytes)
    const localPath = resolveLocalSource(item.thumbnailUrl)
    if (!localPath) {
      localFilesMissing += 1
      continue
    }

    try {
      const outputBuffer = await fs.readFile(localPath)
      const metadata = await sharp(outputBuffer).metadata()
      const sha256 = crypto.createHash('sha256').update(outputBuffer).digest('hex')
      if (
        metadata.width !== TARGET_SIZE
        || metadata.height !== TARGET_SIZE
        || metadata.format !== 'webp'
        || outputBuffer.byteLength !== item.bytes
        || sha256 !== item.sha256
      ) {
        failures.push(`${row.slug}: local thumbnail does not match manifest`)
      }
    } catch (error) {
      failures.push(`${row.slug}: unable to inspect local thumbnail (${error.message})`)
    }
  }

  const stale = Object.keys(items).filter((slug) => {
    if (!isSelectedManifestItem(slug, items[slug], args)) return false
    return !rows.some((row) => row.slug === slug)
  })
  for (const slug of stale) failures.push(`${slug}: stale manifest entry`)

  const oversized = sizes.filter((size) => size > MAX_BYTES).length
  const success = rows.length - missing.length - failures.length + stale.length
  console.log(`species atlas thumbnails · mode=check · selected=${rows.length} · success=${Math.max(0, success)} · missing/failed=${missing.length + failures.length}`)
  console.log(`size · average=${sizes.length ? Math.round(sizes.reduce((sum, value) => sum + value, 0) / sizes.length) : 0} bytes · p95=${percentile(sizes, 0.95)} bytes · over ${MAX_BYTES}=${oversized}`)
  console.log(`manifest · unchanged · ${Object.keys(items).length} entries`)
  if (localFilesMissing > 0) {
    console.log(`local output unavailable: ${localFilesMissing} (manifest URLs remain eligible for OSS upload)`)
  }
  if (missing.length > 0) {
    console.log(`missing samples: ${missing.slice(0, 12).join(', ')}`)
  }
  if (failures.length > 0) {
    console.log(`invalid samples: ${failures.slice(0, 12).join(', ')}`)
  }

  if (failures.length > 0 || oversized > 0 || (rows.length > 0 && missing.length === rows.length)) {
    process.exitCode = 1
  }
}

async function main() {
  loadEnv()
  const args = parseArgs(process.argv.slice(2))
  const rows = selectSpeciesRows(await fetchSpeciesRows(), args)

  const duplicateSlugs = rows
    .map((row) => row.slug)
    .filter((slug, index, all) => all.indexOf(slug) !== index)
  if (duplicateSlugs.length > 0) {
    throw new Error(`Duplicate active species slugs: ${[...new Set(duplicateSlugs)].join(', ')}`)
  }

  if (!args.write) {
    await checkExistingManifest(rows, args)
    return
  }

  const sourceManifests = readSourceManifests()

  const sourceCache = new Map()
  const results = []
  const failures = []
  let cursor = 0

  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++]
      const manifestSources = sourceManifests.get(row.nature_topic)?.get(row.slug) || []
      const sources = [...manifestSources, row.cover_image_url].filter((source, index, all) => typeof source === 'string' && source && all.indexOf(source) === index)
      let built = null

      const sourceErrors = []
      for (const source of sources) {
        try {
          built = await buildThumbnail(row, source, sourceCache)
          if (built) break
          sourceErrors.push(`${source}: no valid image response`)
        } catch (error) {
          sourceErrors.push(`${source}: ${error.message}`)
        }
      }

      if (!built) {
        failures.push({
          slug: row.slug,
          reason: sourceErrors.length > 0 ? sourceErrors.join('; ') : 'no source image configured',
        })
        continue
      }

      results.push({ row, built })
    }
  }

  await Promise.all(Array.from({ length: Math.min(args.concurrency, Math.max(rows.length, 1)) }, () => worker()))

  const previousManifest = readJson(ATLAS_MANIFEST_PATH, { schemaVersion: 1, items: {} })
  const previousItems = previousManifest.items || {}
  const selectedSlugs = args.slugs
  const selectedTopics = args.topics
  const nextItems = Object.fromEntries(
    Object.entries(previousItems).filter(([slug, item]) => {
      if (selectedSlugs?.has(slug)) return false
      if (selectedTopics?.has(item?.topicKey)) return false
      return !selectedTopics && !selectedSlugs ? false : true
    }),
  )
  const sizes = []
  let oversized = 0

  for (const { row, built } of results.sort((left, right) => left.row.slug.localeCompare(right.row.slug))) {
    nextItems[row.slug] = built.item
    sizes.push(built.item.bytes)
    if (built.item.bytes > MAX_BYTES) oversized += 1

    if (args.write) {
      await fs.mkdir(path.dirname(built.outputPath), { recursive: true })
      await fs.writeFile(built.outputPath, built.outputBuffer)
    }
  }

  const manifest = {
    schemaVersion: 1,
    items: Object.fromEntries(Object.entries(nextItems).sort(([left], [right]) => left.localeCompare(right))),
  }
  const nextJson = `${JSON.stringify(manifest, null, 2)}\n`
  const previousJson = `${JSON.stringify(previousManifest, null, 2)}\n`
  const changed = nextJson !== previousJson

  if (args.write) {
    await fs.mkdir(MANIFEST_DIR, { recursive: true })
    await fs.writeFile(ATLAS_MANIFEST_PATH, nextJson, 'utf8')
  }

  console.log(`species atlas thumbnails · mode=${args.write ? 'write' : 'check'} · selected=${rows.length} · success=${results.length} · missing/failed=${failures.length}`)
  console.log(`size · average=${sizes.length ? Math.round(sizes.reduce((sum, value) => sum + value, 0) / sizes.length) : 0} bytes · p95=${percentile(sizes, 0.95)} bytes · over ${MAX_BYTES}=${oversized}`)
  console.log(`manifest · ${changed ? 'changed' : 'unchanged'} · ${Object.keys(manifest.items).length} entries`)
  if (failures.length > 0) {
    console.log(`missing samples: ${failures.slice(0, 12).map((failure) => `${failure.slug} (${failure.reason})`).join(', ')}`)
  }

  if (!args.write && changed) process.exitCode = 1
  if (oversized > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(`species atlas thumbnails failed: ${error.message}`)
  process.exitCode = 1
})
