/**
 * Short-lived HMAC signatures for same-origin /api/assets video URLs.
 * Prevents hotlinking / bandwidth abuse of proxied mp4/webm without DRM.
 *
 * Message: `${canonicalPath}\n${exp}` where exp is unix seconds.
 * Query: ?exp=<seconds>&sig=<hmac-sha256-hex>
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_TTL_SECONDS = 20 * 60 // 20 minutes (within 15–30)

const SIGNED_VIDEO_EXT_RE = /\.(mp4|webm)$/i

export function getAssetsUrlSigningSecret(): string | null {
  const raw = process.env.ASSETS_URL_SIGNING_SECRET?.trim()
  return raw || null
}

export function getAssetsUrlSigningTtlSeconds(): number {
  const configured = Number(process.env.ASSETS_URL_SIGNING_TTL_SECONDS)
  if (!Number.isFinite(configured)) return DEFAULT_TTL_SECONDS
  // Clamp: 60s … 2h
  return Math.min(7200, Math.max(60, Math.round(configured)))
}

/** True for paths that must carry a valid short-lived signature when secret is set. */
export function isSignatureRequiredAssetPath(pathname: string): boolean {
  const pathOnly = pathname.split('?')[0] ?? pathname
  return SIGNED_VIDEO_EXT_RE.test(pathOnly)
}

/**
 * Canonical path for signing/verification: leading slash, each segment
 * decode→encode so `%E5%A5%87` and unicode forms match.
 */
export function canonicalizeAssetPathname(pathname: string): string {
  const withoutQuery = pathname.trim().split('?')[0] ?? ''
  const withSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  const segments = withSlash
    .slice(1)
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return encodeURIComponent(decodeURIComponent(part))
      } catch {
        return encodeURIComponent(part)
      }
    })
  return `/${segments.join('/')}`
}

function computeSignature(secret: string, canonicalPath: string, exp: number): string {
  return createHmac('sha256', secret).update(`${canonicalPath}\n${exp}`, 'utf8').digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'utf8')
    const right = Buffer.from(b, 'utf8')
    return left.length === right.length && timingSafeEqual(left, right)
  } catch {
    return false
  }
}

export type SignedAssetUrlOptions = {
  /** Override expiry unix seconds (testing). */
  exp?: number
  /** Override now ms (testing). */
  nowMs?: number
  /** Override TTL seconds. */
  ttlSeconds?: number
}

/**
 * Attach ?exp=&sig= to an `/api/assets/...` URL when signing secret is configured.
 * Non-proxy / non-video URLs and missing secret → returned unchanged.
 */
export function signAssetProxyUrl(input: string, options: SignedAssetUrlOptions = {}): string {
  const secret = getAssetsUrlSigningSecret()
  if (!secret) return input

  const trimmed = input.trim()
  if (!trimmed.startsWith('/api/assets/')) return input

  const qIndex = trimmed.indexOf('?')
  const pathWithPrefix = qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed
  const existingSearch = qIndex >= 0 ? trimmed.slice(qIndex + 1) : ''
  const assetPath = pathWithPrefix.slice('/api/assets'.length) // starts with /
  if (!isSignatureRequiredAssetPath(assetPath)) {
    return input
  }

  const canonicalPath = canonicalizeAssetPathname(assetPath)
  const nowMs = options.nowMs ?? Date.now()
  const ttl = options.ttlSeconds ?? getAssetsUrlSigningTtlSeconds()
  const exp = options.exp ?? Math.floor(nowMs / 1000) + ttl
  const sig = computeSignature(secret, canonicalPath, exp)

  const params = new URLSearchParams(existingSearch)
  params.delete('exp')
  params.delete('sig')
  params.set('exp', String(exp))
  params.set('sig', sig)
  return `${pathWithPrefix}?${params.toString()}`
}

export type AssetSignatureCheck =
  | { ok: true }
  | { ok: false; reason: 'missing_params' | 'expired' | 'invalid' | 'bad_exp' }

/**
 * Verify exp/sig for a proxied asset pathname (e.g. `/kejiao16a/a/video_1.mp4`).
 * When secret is unset, returns ok (dev without signing).
 */
export function verifyAssetSignature(
  pathname: string,
  expRaw: string | null,
  sigRaw: string | null,
  options: { nowMs?: number } = {},
): AssetSignatureCheck {
  const secret = getAssetsUrlSigningSecret()
  if (!secret) return { ok: true }

  if (!isSignatureRequiredAssetPath(pathname)) return { ok: true }

  if (!expRaw || !sigRaw) return { ok: false, reason: 'missing_params' }

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || !Number.isSafeInteger(exp) || exp <= 0) {
    return { ok: false, reason: 'bad_exp' }
  }

  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000)
  if (exp < nowSec) return { ok: false, reason: 'expired' }

  const canonicalPath = canonicalizeAssetPathname(pathname)
  const expected = computeSignature(secret, canonicalPath, exp)
  if (!safeEqualHex(expected, sigRaw.trim().toLowerCase())) {
    return { ok: false, reason: 'invalid' }
  }

  return { ok: true }
}

/** Search string for upstream CDN: drop signing params so OSS does not see them. */
export function stripAssetSignatureSearch(search: string): string {
  if (!search) return ''
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (!raw) return ''
  const params = new URLSearchParams(raw)
  params.delete('exp')
  params.delete('sig')
  const next = params.toString()
  return next ? `?${next}` : ''
}
