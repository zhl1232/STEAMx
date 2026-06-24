import { NextRequest, NextResponse } from 'next/server'

import { getAssetsBaseUrl, REWRITTEN_ASSET_PREFIXES } from '@/lib/utils/asset-url'

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

  const upstreamUrl = `${baseUrl}${pathname}${request.nextUrl.search}`
  const upstream = await fetch(upstreamUrl, {
    method,
    headers: {
      Referer: getAssetReferer(),
    },
  })

  const headers = new Headers()
  for (const header of PASS_THROUGH_HEADERS) {
    const value = upstream.headers.get(header)
    if (value) headers.set(header, value)
  }
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=86400')
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
