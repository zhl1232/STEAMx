import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

import { NextRequest, NextResponse } from 'next/server'

import { getAssetsBaseUrl, REWRITTEN_ASSET_PREFIXES } from '@/lib/utils/asset-url'

const PUBLIC_DIR = path.join(process.cwd(), 'public')

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mpd': 'model/mpd',
  '.ldr': 'model/ldr',
}

const PASS_THROUGH_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
] as const

const SCRATCH_ASSET_PREFIX = '/scratch/assets/'
const CANONICAL_ASSET_REFERER = 'https://steamx.cc'
const KNOWN_ASSETS_CDN_HOST = 'assets.steamx.cc'
const DEFAULT_ASSET_CONNECT_TIMEOUT_MS = 10_000

function isExpiredCertificateError(error: unknown): boolean {
  let current: unknown = error

  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== 'object') return false
    const code = (current as { code?: unknown }).code
    if (code === 'CERT_HAS_EXPIRED') return true
    current = (current as { cause?: unknown }).cause
  }

  return false
}

/**
 * The CDN certificate can briefly expire before its managed renewal completes.
 * Keep this emergency path limited to our public asset hostname; never silently
 * downgrade an arbitrary configured origin from HTTPS to HTTP.
 */
function getExpiredCertificateFallbackUrl(upstreamUrl: string): string | null {
  try {
    const url = new URL(upstreamUrl)
    if (url.protocol !== 'https:' || url.hostname !== KNOWN_ASSETS_CDN_HOST) return null
    url.protocol = 'http:'
    return url.toString()
  } catch {
    return null
  }
}

function getAssetConnectTimeoutMs() {
  const configured = Number(process.env.ASSET_CONNECT_TIMEOUT_MS)
  if (!Number.isFinite(configured)) return DEFAULT_ASSET_CONNECT_TIMEOUT_MS
  return Math.min(60_000, Math.max(1_000, Math.round(configured)))
}

function isUpstreamTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: string; code?: string; cause?: { code?: string; name?: string } }
  if (candidate.name === 'AbortError' || candidate.name === 'TimeoutError') return true
  if (candidate.code === 'ABORT_ERR' || candidate.code === 'UND_ERR_CONNECT_TIMEOUT') return true
  const cause = candidate.cause
  if (!cause) return false
  return (
    cause.name === 'AbortError' ||
    cause.name === 'TimeoutError' ||
    cause.code === 'ABORT_ERR' ||
    cause.code === 'UND_ERR_CONNECT_TIMEOUT'
  )
}

function isAllowedAssetPath(pathname: string) {
  return (
    pathname.startsWith(SCRATCH_ASSET_PREFIX) ||
    REWRITTEN_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}

function getAssetReferer() {
  return (
    process.env.ASSETS_PROXY_REFERER ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    CANONICAL_ASSET_REFERER
  )
}

async function fetchUpstreamAsset(
  upstreamUrl: string,
  method: 'GET' | 'HEAD',
  isScratchAsset: boolean,
  requestHeaders: Headers,
) {
  const referer = getAssetReferer()
  const fetchWithReferer = async (url: string, value: string) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), getAssetConnectTimeoutMs())
    const headers = new Headers({ Referer: value })
    const range = requestHeaders.get('range')
    const ifRange = requestHeaders.get('if-range')
    if (range) headers.set('Range', range)
    if (ifRange) headers.set('If-Range', ifRange)

    try {
      // Clear the timer once headers arrive so long video/audio streams are not
      // aborted midway through a healthy download.
      return await fetch(url, {
        method,
        cache: isScratchAsset && !headers.has('Range') ? 'force-cache' : 'no-store',
        headers,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  const fallbackUrl = getExpiredCertificateFallbackUrl(upstreamUrl)
  let requestUrl = upstreamUrl
  let upstream: Response
  try {
    upstream = await fetchWithReferer(requestUrl, referer)
  } catch (error) {
    const emergencyUrl = fallbackUrl && isExpiredCertificateError(error) ? fallbackUrl : null
    if (!emergencyUrl) throw error
    requestUrl = emergencyUrl
    upstream = await fetchWithReferer(requestUrl, referer)
  }

  if (upstream.status !== 403 || referer === CANONICAL_ASSET_REFERER) return upstream
  await upstream.body?.cancel().catch(() => undefined)
  return fetchWithReferer(requestUrl, CANONICAL_ASSET_REFERER)
}

function inferContentType(filePath: string) {
  return CONTENT_TYPE_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function isLdrawLibraryPath(pathname: string) {
  return pathname.startsWith('/courses/ldraw/') && /\.(mpd|ldr)$/i.test(pathname)
}

/** 解析本地 public/ 文件（开发环境或 OSS 故障回退）。 */
async function resolveLocalPublicAsset(pathname: string, { allowProduction = false } = {}) {
  if (process.env.NODE_ENV === 'production' && !allowProduction) return null

  const relativePath = pathname.replace(/^\/+/, '')
  const localPath = path.resolve(PUBLIC_DIR, relativePath)
  if (!localPath.startsWith(`${path.resolve(PUBLIC_DIR)}${path.sep}`)) return null

  try {
    const fileStat = await stat(/* turbopackIgnore: true */ localPath)
    if (!fileStat.isFile()) return null
    return {
      localPath,
      size: fileStat.size,
      modifiedAt: fileStat.mtime,
      contentType: inferContentType(localPath),
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

type ByteRange = { start: number; end: number }

function parseByteRange(value: string | null, size: number): ByteRange | 'invalid' | null {
  if (!value) return null
  if (size <= 0) return 'invalid'
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid'

  if (match[1] === '') {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return 'invalid'
    return { start: Math.max(0, size - suffixLength), end: Math.max(0, size - 1) }
  }

  const start = Number(match[1])
  const requestedEnd = match[2] === '' ? size - 1 : Number(match[2])
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) {
    return 'invalid'
  }

  return { start, end: Math.min(requestedEnd, size - 1) }
}

async function respondWithLocalAsset(
  request: NextRequest,
  pathname: string,
  method: 'GET' | 'HEAD',
  { allowProduction = false }: { allowProduction?: boolean } = {},
) {
  const local = await resolveLocalPublicAsset(pathname, { allowProduction })
  if (!local) return null

  const cacheControl = isLdrawLibraryPath(pathname)
    ? 'no-cache, must-revalidate'
    : pathname.startsWith(SCRATCH_ASSET_PREFIX)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400'
  const range = parseByteRange(request.headers.get('range'), local.size)
  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${local.size}`,
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  const start = range?.start ?? 0
  const end = range?.end ?? Math.max(0, local.size - 1)
  const contentLength = local.size === 0 ? 0 : end - start + 1
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': cacheControl,
    'Content-Length': String(contentLength),
    'Content-Type': local.contentType,
    'Last-Modified': local.modifiedAt.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  })
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${local.size}`)

  const body = method === 'HEAD' || local.size === 0
    ? null
    : Readable.toWeb(
        createReadStream(/* turbopackIgnore: true */ local.localPath, { start, end }),
      ) as ReadableStream<Uint8Array>

  return new Response(body, {
    status: range ? 206 : 200,
    headers,
  })
}

async function proxyAsset(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
  method: 'GET' | 'HEAD',
) {
  const { path } = await params
  const pathname = `/${path.map((part) => encodeURIComponent(part)).join('/')}`
  if (!isAllowedAssetPath(pathname)) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  const baseUrl = getAssetsBaseUrl()
  if (!baseUrl) {
    // 开发环境未配置 ASSETS_BASE_URL 时，回退到 public/ 本地文件
    const localResponse = await respondWithLocalAsset(request, pathname, method, { allowProduction: true })
    if (localResponse) return localResponse
    return NextResponse.json({ error: 'Assets base URL is not configured' }, { status: 404 })
  }

  // LDraw 库始终走 public/ 本地（文件小、打包后最新，避免 OSS/CDN 旧缓存）
  if (isLdrawLibraryPath(pathname)) {
    const localResponse = await respondWithLocalAsset(request, pathname, method, { allowProduction: true })
    if (localResponse) return localResponse
  }

  const upstreamUrl = `${baseUrl}${pathname}${request.nextUrl.search}`
  const isScratchAsset = pathname.startsWith(SCRATCH_ASSET_PREFIX)
  let upstream: Response
  try {
    // Scratch 素材按 md5 寻址，允许 CDN/Next 缓存；其它资源仍 no-store 防盗链抖动。
    upstream = await fetchUpstreamAsset(upstreamUrl, method, isScratchAsset, request.headers)
  } catch (error) {
    const localResponse = await respondWithLocalAsset(request, pathname, method, { allowProduction: true })
    if (localResponse) return localResponse
    // Upstream abort/timeout under concurrent page navigations used to rethrow and
    // surface as 500 + unhandledRejection ("Cannot set property message...").
    const timedOut = isUpstreamTimeoutError(error)
    return NextResponse.json(
      { error: timedOut ? 'Asset upstream timeout' : 'Asset upstream unavailable' },
      { status: timedOut ? 504 : 502 },
    )
  }

  if (!upstream.ok) {
    const localResponse = await respondWithLocalAsset(request, pathname, method, { allowProduction: true })
    if (localResponse) {
      await upstream.body?.cancel().catch(() => undefined)
      return localResponse
    }
  }

  const headers = new Headers()
  for (const header of PASS_THROUGH_HEADERS) {
    const value = upstream.headers.get(header)
    if (value) headers.set(header, value)
  }
  if (!headers.has('cache-control')) {
    headers.set(
      'cache-control',
      isLdrawLibraryPath(pathname)
        ? 'no-cache, must-revalidate'
        : isScratchAsset
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=86400',
    )
  } else if (isScratchAsset) {
    // 覆盖上游过短缓存，造型/声音按 md5 可长期缓存
    headers.set('cache-control', 'public, max-age=31536000, immutable')
  }

  return new Response(method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyAsset(request, context, 'GET')
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyAsset(request, context, 'HEAD')
}
