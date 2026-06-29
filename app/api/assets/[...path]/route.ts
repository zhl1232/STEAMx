import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

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
  'content-type',
  'etag',
  'last-modified',
] as const

const SCRATCH_ASSET_PREFIX = '/scratch/assets/'

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
    'https://steamx.cc'
  )
}

function inferContentType(filePath: string) {
  return CONTENT_TYPE_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function isLdrawLibraryPath(pathname: string) {
  return pathname.startsWith('/courses/ldraw/') && /\.(mpd|ldr)$/i.test(pathname)
}

function countEmbeddedLdrawFiles(text: string) {
  return (text.match(/^0 FILE /gm) ?? []).length
}

/** 本地 public/ 读取（开发环境，或 LDraw MPD 需与 OSS 比完整性时）。 */
async function readLocalPublicAsset(pathname: string, { allowProduction = false } = {}) {
  if (process.env.NODE_ENV === 'production' && !allowProduction) return null

  const relativePath = pathname.replace(/^\/+/, '')
  const localPath = path.resolve(PUBLIC_DIR, relativePath)
  if (!localPath.startsWith(`${path.resolve(PUBLIC_DIR)}${path.sep}`)) return null
  if (!existsSync(localPath)) return null

  const data = await fs.readFile(localPath)
  return {
    data,
    contentType: inferContentType(localPath),
  }
}

async function respondWithLocalAsset(
  pathname: string,
  { allowProduction = false }: { allowProduction?: boolean } = {},
) {
  const local = await readLocalPublicAsset(pathname, { allowProduction })
  if (!local) return null

  const cacheControl = isLdrawLibraryPath(pathname)
    ? 'no-cache, must-revalidate'
    : 'public, max-age=86400'

  return new Response(local.data, {
    status: 200,
    headers: {
      'Content-Type': local.contentType,
      'Cache-Control': cacheControl,
    },
  })
}

async function proxyAsset(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
  method: 'GET' | 'HEAD',
) {
  const baseUrl = getAssetsBaseUrl()
  if (!baseUrl) {
    return NextResponse.json({ error: 'Assets base URL is not configured' }, { status: 404 })
  }

  const { path } = await params
  const pathname = `/${path.map((part) => encodeURIComponent(part)).join('/')}`
  if (!isAllowedAssetPath(pathname)) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  // LDraw 库始终走 public/ 本地（文件小、打包后最新，避免 OSS/CDN 旧缓存）
  if (isLdrawLibraryPath(pathname)) {
    const localResponse = await respondWithLocalAsset(pathname, { allowProduction: true })
    if (localResponse) return localResponse
  }

  const upstreamUrl = `${baseUrl}${pathname}${request.nextUrl.search}`
  const upstream = await fetch(upstreamUrl, {
    method,
    cache: 'no-store',
    headers: {
      Referer: getAssetReferer(),
    },
  })

  if (upstream.status === 404) {
    const localResponse = await respondWithLocalAsset(pathname, { allowProduction: true })
    if (localResponse) return localResponse
  }

  // 打包 MPD：OSS 可能是旧版（缺内联 0 FILE 块），本地 public/ 更完整时优先本地。
  if (method === 'GET' && upstream.ok && isLdrawLibraryPath(pathname)) {
    const local = await readLocalPublicAsset(pathname, { allowProduction: true })
    if (local) {
      const upstreamText = await upstream.clone().text()
      const localText = local.data.toString('utf8')
      const upstreamEmbedded = countEmbeddedLdrawFiles(upstreamText)
      const localEmbedded = countEmbeddedLdrawFiles(localText)
      if (localEmbedded > upstreamEmbedded) {
        const localResponse = await respondWithLocalAsset(pathname, { allowProduction: true })
        if (localResponse) return localResponse
      }
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
      isLdrawLibraryPath(pathname) ? 'no-cache, must-revalidate' : 'public, max-age=86400',
    )
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
