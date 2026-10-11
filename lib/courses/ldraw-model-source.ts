import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { BoundedTtlMap } from '@/lib/utils/bounded-ttl-map'

const MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.mpd$/
const LDRAW_DIRECTORY = path.resolve(process.cwd(), 'public/courses/ldraw')
export const MAX_LDRAW_MODEL_BYTES = 16 * 1024 * 1024
const REMOTE_TTL_MS = 60_000
const LOCAL_TTL_MS = 10_000
const MAX_MODEL_CACHE_BYTES = 64 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 12_000

export class LdrawModelMissingError extends Error { readonly code = 'ENOENT' }
export class LdrawModelUnavailableError extends Error {}
export class LdrawModelBusyError extends Error {}
export class LdrawModelTooLargeError extends RangeError {}
export class LdrawModelInvalidError extends Error {}

export type LdrawModelSource = 'remote' | 'local'
export interface LdrawModel {
  model: string
  text: string
  sha256: string
  source: LdrawModelSource
  localFileName?: string
  localFingerprint?: string
}

const modelCache = new Map<string, { value: LdrawModel; bytes: number; expiresAt: number }>()
let modelCachedBytes = 0
function removeCachedModel(key: string) {
  const entry = modelCache.get(key)
  if (entry) modelCachedBytes -= entry.bytes
  modelCache.delete(key)
}
function cachedModel(key: string): LdrawModel | undefined {
  const entry = modelCache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) { removeCachedModel(key); return undefined }
  modelCache.delete(key)
  modelCache.set(key, entry)
  return entry.value
}
function cacheModel(key: string, value: LdrawModel, ttl: number) {
  removeCachedModel(key)
  for (const [oldKey, entry] of modelCache) {
    if (entry.expiresAt <= Date.now()) removeCachedModel(oldKey)
  }
  const bytes = value.text.length * 2
  if (ttl <= 0 || bytes > MAX_MODEL_CACHE_BYTES) return
  while ((modelCachedBytes + bytes > MAX_MODEL_CACHE_BYTES || modelCache.size >= 16) && modelCache.size) {
    const oldest = modelCache.keys().next().value
    if (oldest === undefined) break
    removeCachedModel(oldest)
  }
  modelCache.set(key, { value, bytes, expiresAt: Date.now() + ttl })
  modelCachedBytes += bytes
}
const inFlight = new Map<string, Promise<LdrawModel>>()
const probeCache = new BoundedTtlMap<string, boolean>(64)
const probeInFlight = new Map<string, Promise<boolean>>()
let remoteActive = 0
const remoteWaiters: Array<() => void> = []

async function acquireRemoteSlot() {
  if (remoteActive < 4) { remoteActive++; return }
  await new Promise<void>((resolve) => remoteWaiters.push(resolve))
}
function releaseRemoteSlot() {
  const next = remoteWaiters.shift()
  if (next) next()
  else remoteActive--
}

export function isValidLdrawModelName(model: string): boolean {
  return MODEL_NAME_PATTERN.test(model) && !model.includes('..')
}

function localPath(model: string) { return path.join(LDRAW_DIRECTORY, model) }

function assertValidMpd(text: string): void {
  const lines = text.split(/\r?\n/)
  const hasFile = lines.some((line) => /^0 FILE\s+\S/.test(line))
  const hasGeometry = lines.some((line) => /^[1-5]\s+/.test(line.trim()))
  if (!hasFile || !hasGeometry || /^\s*<(?:!DOCTYPE|html)\b/i.test(text)) {
    throw new LdrawModelInvalidError('LDraw MPD content is invalid')
  }
}

function makeModel(model: string, bytes: Uint8Array, source: LdrawModelSource): LdrawModel {
  if (bytes.byteLength > MAX_LDRAW_MODEL_BYTES) throw new LdrawModelTooLargeError('LDraw model is too large')
  const text = new TextDecoder().decode(bytes)
  assertValidMpd(text)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const expected = model.match(/-([a-f0-9]{64})\.mpd$/i)?.[1]
  if (expected && expected.toLowerCase() !== sha256) throw new LdrawModelInvalidError('LDraw model content hash does not match filename')
  return { model, text, source, sha256 }
}

async function readLocal(model: string): Promise<LdrawModel> {
  const unhashed = model.replace(/-[a-f0-9]{64}\.mpd$/i, '.mpd')
  const candidates = unhashed === model ? [model] : [model, unhashed]
  let lastError: unknown = new LdrawModelMissingError('LDraw model not found')
  for (const candidate of candidates) {
    try {
      const file = localPath(candidate)
      const info = await stat(file)
      if (!info.isFile()) throw new LdrawModelMissingError('LDraw model not found')
      if (info.size > MAX_LDRAW_MODEL_BYTES) throw new LdrawModelTooLargeError('LDraw model is too large')
      // Validate bytes against the requested immutable name, even for the base file.
      return { ...makeModel(model, await readFile(file), 'local'), localFileName: candidate,
        localFingerprint: `${info.mtimeMs}:${info.size}` }
    } catch (error) {
      lastError = (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? new LdrawModelMissingError('LDraw model not found') : error
    }
  }
  throw lastError
}

function remoteBase(): string | null {
  const value = process.env.NEXT_PUBLIC_ASSETS_BASE_URL?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password || url.search || url.hash) return null
    return url.toString().replace(/\/$/, '')
  } catch { return null }
}

async function readRemote(model: string, base: string): Promise<LdrawModel> {
  await acquireRemoteSlot()
  const url = `${base}/courses/ldraw/${encodeURIComponent(model)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response | undefined
  try {
    response = await fetch(url, {
      cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Referer: process.env.LDRAW_ASSETS_REFERER || 'https://www.steamx.cc/' },
    })
    if (response.status === 404) throw new LdrawModelMissingError('Remote LDraw model not found')
    if (!response.ok) throw new LdrawModelUnavailableError(`Remote LDraw model returned ${response.status}`)
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_LDRAW_MODEL_BYTES) throw new LdrawModelTooLargeError('LDraw model is too large')
    if (!response.body) throw new LdrawModelUnavailableError('Remote LDraw model has no body')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      while (true) {
        const next = await reader.read()
        if (next.done) break
        total += next.value.byteLength
        if (total > MAX_LDRAW_MODEL_BYTES) { await reader.cancel(); throw new LdrawModelTooLargeError('LDraw model is too large') }
        chunks.push(next.value)
      }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return makeModel(model, bytes, 'remote')
  } catch (error) {
    if (error instanceof LdrawModelMissingError || error instanceof LdrawModelTooLargeError) throw error
    if (error instanceof LdrawModelInvalidError) throw new LdrawModelUnavailableError('Remote LDraw model content is invalid')
    throw new LdrawModelUnavailableError('Remote LDraw model is temporarily unavailable')
  } finally {
    clearTimeout(timer)
    controller.abort()
    if (response?.body && !response.body.locked) void response.body.cancel().catch(() => undefined)
    releaseRemoteSlot()
  }
}

export async function readLdrawModel(model: string): Promise<LdrawModel> {
  if (!isValidLdrawModelName(model)) throw new LdrawModelInvalidError('Invalid LDraw model name')
  const base = remoteBase()
  const cacheKey = `${base ?? 'local'}:${model}`
  const cached = cachedModel(cacheKey)
  if (cached?.source === 'remote') return cached
  if (cached?.source === 'local') {
    try {
      const info = await stat(localPath(cached.localFileName ?? model))
      if (`${info.mtimeMs}:${info.size}` === cached.localFingerprint) return cached
    } catch { /* re-resolve the local candidates */ }
    removeCachedModel(cacheKey)
  }
  const existing = inFlight.get(cacheKey)
  if (existing) return existing
  if (base && inFlight.size >= 4) throw new LdrawModelBusyError('Too many LDraw model loads are running')
  const promise = (async () => {
    try {
      const local = await readLocal(model)
      cacheModel(cacheKey, local, LOCAL_TTL_MS)
      return local
    } catch (localError) {
      if (!base) throw localError
      const remote = await readRemote(model, base)
      cacheModel(cacheKey, remote, REMOTE_TTL_MS)
      return remote
    }
  })().finally(() => { if (inFlight.get(cacheKey) === promise) inFlight.delete(cacheKey) })
  inFlight.set(cacheKey, promise)
  return promise
}

export async function hasLdrawModelFile(modelUrl: string | null | undefined): Promise<boolean> {
  const model = modelUrl?.split(/[?#]/)[0].split('/').pop() ?? ''
  if (!isValidLdrawModelName(model)) return false
  try { const info = await stat(localPath(model)); if (info.isFile()) return true } catch { /* probe OSS */ }
  const base = remoteBase()
  if (!base) return false
  // The publisher verifies immutable objects before their trusted URLs enter lesson content.
  // Sitemap must not download (or probe) every model on each cold generation.
  if (/-[a-f0-9]{64}\.mpd$/i.test(model) && modelUrl) {
    try {
      const publishedUrl = new URL(modelUrl)
      const expectedUrl = new URL(`${base}/courses/ldraw/${model}`)
      if (publishedUrl.origin === expectedUrl.origin && publishedUrl.pathname === expectedUrl.pathname &&
          !publishedUrl.username && !publishedUrl.password) return true
    } catch { /* legacy relative URLs use the bounded existence probe */ }
  }
  const key = `${base}/${model}`
  const cached = probeCache.get(key)
  if (cached !== undefined) return cached
  const existing = probeInFlight.get(key)
  if (existing) return existing
  const promise = (async () => {
    await acquireRemoteSlot()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(`${base}/courses/ldraw/${encodeURIComponent(model)}`, {
        method: 'HEAD', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { Referer: process.env.LDRAW_ASSETS_REFERER || 'https://www.steamx.cc/' },
      })
      const found = response.ok
      if (found || response.status === 404) probeCache.set(key, found, Date.now() + REMOTE_TTL_MS)
      return found
    } catch { return false } finally { clearTimeout(timer); controller.abort(); releaseRemoteSlot() }
  })()
  probeInFlight.set(key, promise)
  promise.finally(() => { if (probeInFlight.get(key) === promise) probeInFlight.delete(key) }).catch(() => undefined)
  return promise
}
