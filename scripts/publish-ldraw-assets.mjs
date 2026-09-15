#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MODEL_DIR = path.join(ROOT, 'public/courses/ldraw')
const REVIEW_DIR = path.join(ROOT, 'scripts/ldraw-reviews')
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA_RE = /^[a-f0-9]{64}$/
const MAX_MPD_BYTES = 16 * 1024 * 1024
const OSS_PREFIX = 'courses/ldraw/'

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function parseArgs(argv) {
  const options = { upload: false, dryRun: true }
  let uploadSeen = false; let dryRunSeen = false
  for (const arg of argv) {
    if (arg === '--upload') { uploadSeen = true; options.upload = true; options.dryRun = false; continue }
    if (arg === '--dry-run') { dryRunSeen = true; options.dryRun = true; options.upload = false; continue }
    const match = arg.match(/^--(only|prefix|manifest)=(.*)$/)
    if (match) { options[match[1]] = match[2]; continue }
    if (arg === '--help' || arg === '-h') { options.help = true; continue }
    throw new Error(`Unknown argument: ${arg}`)
  }
  if (options.help) return options
  if (uploadSeen && dryRunSeen) throw new Error('Cannot combine --upload and --dry-run')
  if (!options.only && !options.prefix) throw new Error('Specify exactly one of --only=<slug,...> or --prefix=<prefix>')
  if (options.only && options.prefix) throw new Error('Specify only one of --only and --prefix')
  if (options.only) {
    options.slugs = options.only.split(',').map((slug) => slug.trim())
    if (!options.slugs.length || options.slugs.some((slug) => !SLUG_RE.test(slug))) throw new Error('Invalid slug in --only')
    if (new Set(options.slugs).size !== options.slugs.length) throw new Error('Duplicate slug in --only')
  } else {
    if (!/^\d+-[a-z0-9-]*$/.test(options.prefix) || options.prefix.includes('..') || options.prefix.includes('/')) throw new Error('Invalid --prefix')
  }
  return options
}

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, name)
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const text = line.trim(); if (!text || text.startsWith('#')) continue
      const index = text.indexOf('='); if (index < 0) continue
      const key = text.slice(0, index).trim(); const value = text.slice(index + 1).trim().replace(/^"|"$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  }
}

function urlFor(base, key) { return `${base ? base.replace(/\/+$/, '') : ''}/courses/ldraw/${key}` }

export async function makePlan({ modelDir = MODEL_DIR, reviewDir = REVIEW_DIR, only, prefix, assetsBaseUrl = process.env.NEXT_PUBLIC_ASSETS_BASE_URL }) {
  if ((!only && !prefix) || (only && prefix)) throw new Error('Specify exactly one selector')
  if (typeof only === 'string') only = only.split(',').map((slug) => slug.trim())
  const names = (await readdir(modelDir)).filter((name) => name.endsWith('.mpd') && !/-[a-f0-9]{64}\.mpd$/i.test(name))
  const slugs = (only ? only : names.map((name) => name.slice(0, -4)).filter((slug) => slug.startsWith(prefix))).slice().sort()
  const errors = []
  if (!assetsBaseUrl) errors.push('NEXT_PUBLIC_ASSETS_BASE_URL is required')
  else {
    try {
      const base = new URL(assetsBaseUrl)
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error()
      assetsBaseUrl = base.toString().replace(/\/+$/, '')
    } catch { errors.push('NEXT_PUBLIC_ASSETS_BASE_URL must be an HTTP(S) base URL without credentials or query') }
  }
  const configPath = path.join(modelDir, 'LDConfig.ldr')
  if (!existsSync(configPath)) errors.push('LDConfig.ldr missing')
  const items = []
  for (const slug of slugs) {
    if (!SLUG_RE.test(slug)) { errors.push(`${slug}: invalid slug`); continue }
    const modelPath = path.join(modelDir, `${slug}.mpd`)
    if (!existsSync(modelPath)) { errors.push(`${slug}: canonical MPD missing`); continue }
    const body = await readFile(modelPath)
    if (body.length === 0 || body.length > MAX_MPD_BYTES || !/^0 FILE\s+[^\r\n]+/m.test(body.toString('utf8')) || !/\n[1-5]\s/m.test(body.toString('utf8'))) {
      errors.push(`${slug}: invalid or oversized MPD`); continue
    }
    const hash = sha256(body)
    const reviewPath = path.join(reviewDir, `${slug}.ldr.json`)
    if (!existsSync(reviewPath)) { errors.push(`${slug}: review missing`); continue }
    let review
    try { review = JSON.parse(await readFile(reviewPath, 'utf8')) } catch { errors.push(`${slug}: invalid review JSON`); continue }
    if (!SHA_RE.test(review?.revision) || review.revision !== hash) { errors.push(`${slug}: review revision does not match MPD SHA256`); continue }
    if (typeof review.confirmedAt !== 'string' || Number.isNaN(Date.parse(review.confirmedAt))) { errors.push(`${slug}: review confirmedAt invalid`); continue }
    const filename = `${slug}-${hash}.mpd`
    items.push({ slug, revision: hash, filename, objectKey: `${OSS_PREFIX}${filename}`, modelURL: urlFor(assetsBaseUrl, filename), body })
  }
  if (items.length === 0 && errors.length === 0) errors.push('No canonical MPD matched selector')
  let color
  if (existsSync(configPath)) {
    const body = await readFile(configPath)
    const revision = sha256(body)
    const filename = `LDConfig-${revision}.ldr`
    color = { revision, filename, objectKey: `${OSS_PREFIX}${filename}`, URL: urlFor(assetsBaseUrl, filename), body }
  }
  if (errors.length) throw Object.assign(new Error(`Preflight failed:\n${errors.join('\n')}`), { errors })
  return { items, color, assetsBaseUrl, errors: [] }
}

async function objectHash(client, key) {
  const result = await client.get(key)
  const content = result?.content ?? result
  return sha256(Buffer.isBuffer(content) ? content : Buffer.from(content))
}

async function putImmutable(client, asset) {
  let present = false
  try {
    await client.head(asset.objectKey)
    present = true
  } catch (error) {
    const missing = error?.code === 'NoSuchKey' || error?.code === 'NotFound' || error?.status === 404 || error?.statusCode === 404 || error?.status?.code === 404
    if (!missing) throw error
  }
  if (present) {
    const existing = await objectHash(client, asset.objectKey)
    if (existing !== asset.revision) throw new Error(`Existing object hash mismatch: ${asset.objectKey}`)
    return 'skipped'
  }
  await client.put(asset.objectKey, asset.body, { headers: { 'Content-Type': asset.filename.endsWith('.mpd') ? 'application/octet-stream' : 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=31536000, immutable' } })
  const actual = await objectHash(client, asset.objectKey)
  if (actual !== asset.revision) throw new Error(`Uploaded object hash mismatch: ${asset.objectKey}`)
  return 'uploaded'
}

export async function publishPlan(plan, { client, onProgress = async () => {} }) {
  if (!client) throw new Error('OSS client is required for upload')
  const results = []
  try {
    if (plan.color) { const status = await putImmutable(client, plan.color); results.push({ filename: plan.color.filename, revision: plan.color.revision, colorURL: plan.color.URL, status }); await onProgress(results) }
    for (const item of plan.items) { const status = await putImmutable(client, item); results.push({ slug: item.slug, revision: item.revision, modelURL: item.modelURL, colorURL: plan.color?.URL ?? null, status }); await onProgress(results) }
  } catch (error) { error.partial = results; throw error }
  return results
}

export async function run(argv = process.argv.slice(2), deps = {}) {
  const options = parseArgs(argv)
  if (options.help) return printHelp()
  loadEnv()
  const plan = await makePlan({ ...options, modelDir: deps.modelDir ?? MODEL_DIR, reviewDir: deps.reviewDir ?? REVIEW_DIR, assetsBaseUrl: deps.assetsBaseUrl ?? process.env.NEXT_PUBLIC_ASSETS_BASE_URL })
  let manifest
  if (options.upload) {
    const assets = []; manifest = { generatedAt: new Date().toISOString(), assets }
    // Establish the result destination before the first external write.
    if (options.manifest) {
      await mkdir(path.dirname(path.resolve(options.manifest)), { recursive: true })
      await writeFile(path.resolve(options.manifest), `${JSON.stringify(manifest, null, 2)}\n`)
    }
    try { assets.push(...await publishPlan(plan, {
      client: deps.client ?? (await import(path.join(ROOT, 'lib/utils/oss-client.mjs'))).createOssClient(),
      onProgress: async (completed) => {
        if (options.manifest) await writeFile(path.resolve(options.manifest), `${JSON.stringify({ ...manifest, assets: completed }, null, 2)}\n`)
      },
    })) }
    catch (error) { manifest.assets.push(...(error.partial ?? [])); manifest.error = error.message; if (options.manifest) await writeFile(path.resolve(options.manifest), `${JSON.stringify(manifest, null, 2)}\n`); else console.info(JSON.stringify(manifest, null, 2)); throw error }
  } else {
    manifest = { dryRun: true, assets: plan.items.map((item) => ({ slug: item.slug, revision: item.revision, modelURL: item.modelURL, colorURL: plan.color?.URL ?? null, status: 'planned' })) }
  }
  const output = JSON.stringify(manifest, null, 2)
  if (options.manifest) await writeFile(path.resolve(options.manifest), `${output}\n`)
  else console.info(output)
  return manifest
}

function printHelp() { console.info('Usage: node scripts/publish-ldraw-assets.mjs (--only=<slug,...>|--prefix=<prefix>) [--upload] [--manifest=<path>]') }

if (import.meta.url === `file://${process.argv[1]}`) run().catch((error) => { console.error(error.message); process.exitCode = 1 })
