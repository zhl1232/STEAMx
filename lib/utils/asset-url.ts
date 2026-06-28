/**
 * 统一把仓库历史保留的本地资源路径（如 /birds/images/xxx.jpg、/birds/audio/xxx.ogg）重写为对象存储 URL。
 *
 * 设计原则：
 * - 只重写白名单前缀，避免误伤 /assets、/scratch、用户上传等路径
 * - 已是 http(s) 完整 URL 的直接放行
 * - 配置 base URL 后各环境先统一解析为同一资源域名
 * - 配置 CDN 防盗链时，各环境默认经 /api/assets 代理并附带 Referer；直连 CDN 会 403
 * - LDraw（.mpd/.ldr）始终走 /api/assets（FileLoader 不带 Referer）
 * - 排查 CDN 原文件时可显式设置 NEXT_PUBLIC_ASSETS_DISPLAY_MODE=direct
 */

const REMOTE_ASSET_PREFIXES = [
  '/birds/',
  '/insects/',
  '/trees/',
  '/fruits/',
  '/projects/',
  '/courses/',
] as const

export function getAssetsBaseUrl(): string | null {
  const raw = process.env.ASSETS_BASE_URL || process.env.NEXT_PUBLIC_ASSETS_BASE_URL
  if (!raw) return null

  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed || null
}

function shouldRewrite(pathname: string): boolean {
  return REMOTE_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function splitPathAndQuery(input: string): { pathname: string; search: string } {
  const [pathname, query = ''] = input.split('?', 2)
  const search = query ? `?${query}` : ''
  return { pathname, search }
}

/**
 * 从相对路径或绝对 URL 提取 OSS 对象路径（如 `/courses/foo.png`）。
 * 不依赖 build 时是否注入 NEXT_PUBLIC_ASSETS_BASE_URL，避免生产客户端漏配 env 时无法代理。
 */
function parseWhitelistedAssetPath(input: string): { pathname: string; search: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/')) {
    const { pathname, search } = splitPathAndQuery(trimmed)
    return shouldRewrite(pathname) ? { pathname, search } : null
  }

  const configuredPath = getConfiguredAssetPath(trimmed)
  if (configuredPath) {
    try {
      const url = new URL(trimmed)
      return { pathname: configuredPath, search: url.search }
    } catch {
      return null
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (shouldRewrite(url.pathname)) {
        return { pathname: url.pathname, search: url.search }
      }
    } catch {
      return null
    }
  }

  return null
}

function getConfiguredAssetPath(input: string): string | null {
  const baseUrl = getAssetsBaseUrl()
  if (!baseUrl) return null

  try {
    const sourceUrl = new URL(input)
    const configuredUrl = new URL(`${baseUrl}/`)

    if (sourceUrl.origin !== configuredUrl.origin) return null

    const configuredPath = configuredUrl.pathname.replace(/\/+$/, '')
    const assetPath = configuredPath
      ? sourceUrl.pathname.startsWith(`${configuredPath}/`)
        ? sourceUrl.pathname.slice(configuredPath.length)
        : null
      : sourceUrl.pathname

    if (!assetPath || !shouldRewrite(assetPath)) return null

    return assetPath
  } catch {
    return null
  }
}

export function isConfiguredAssetUrl(input: string | null | undefined): boolean {
  if (!input) return false

  return parseWhitelistedAssetPath(input) !== null
}

export function isProxiedAssetDisplayUrl(input: string | null | undefined): boolean {
  if (!input || typeof input !== 'string') return false
  return input.startsWith('/api/assets/')
}

export function shouldBypassAssetImageOptimization(input: string | null | undefined): boolean {
  return isProxiedAssetDisplayUrl(input) || isConfiguredAssetUrl(input)
}

function shouldProxyConfiguredAssets() {
  return process.env.NEXT_PUBLIC_ASSETS_DISPLAY_MODE !== 'direct'
}

/** LDraw 模型/配色：CDN 防盗链，浏览器 FileLoader 不带 Referer 会 403 返回 HTML。始终走 /api/assets。 */
function isLdrawLibraryPath(pathname: string): boolean {
  const path = pathname.split('?')[0]
  return path.startsWith('/courses/ldraw/') && /\.(mpd|ldr)$/i.test(path)
}

function shouldProxyAssetPath(pathname: string): boolean {
  if (isLdrawLibraryPath(pathname)) return true
  return shouldProxyConfiguredAssets()
}

export function getAssetDisplayUrl(input: string | null | undefined): string | null | undefined {
  if (input == null) return input
  if (typeof input !== 'string') return input

  const trimmed = input.trim()
  if (!trimmed) return input

  const parsed = parseWhitelistedAssetPath(trimmed)
  if (!parsed || !shouldProxyAssetPath(parsed.pathname)) return input

  return `/api/assets${parsed.pathname}${parsed.search}`
}

/**
 * 展示用资源 URL：先把 `/birds/...` 等本地路径重写到 CDN，再经 `/api/assets` 代理（绕过 CDN 防盗链）。
 */
export function resolveAssetDisplayUrl(input: string | null | undefined): string | null | undefined {
  if (input == null) return input
  if (typeof input !== 'string') return input

  const trimmed = input.trim()
  if (!trimmed) return input

  const directProxy = getAssetDisplayUrl(trimmed)
  if (directProxy !== trimmed) return directProxy

  const rewritten = rewriteAssetUrl(trimmed) ?? trimmed
  return getAssetDisplayUrl(rewritten) ?? rewritten
}

export function shouldBypassAssetDisplayOptimization(input: string | null | undefined): boolean {
  if (!input || typeof input !== 'string') return false
  if (isProxiedAssetDisplayUrl(input)) return true
  const rewritten = rewriteAssetUrl(input) ?? input
  return isConfiguredAssetUrl(rewritten) || shouldRewrite(input.trim().split('?')[0])
}

/**
 * 把本地资源路径重写为远程 URL。
 * 输入 `/birds/images/foo.jpg` → 输出 `https://assets.example.com/birds/images/foo.jpg`
 *
 * 已是远程 URL、不在白名单内的路径、空值都原样返回。
 */
export function rewriteAssetUrl(input: string | null | undefined): string | null | undefined {
  if (input == null) return input
  if (typeof input !== 'string') return input

  const trimmed = input.trim()
  if (!trimmed) return input

  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const baseUrl = getAssetsBaseUrl()
  if (!baseUrl) return trimmed

  const [pathnamePart, queryPart = ''] = trimmed.split('?', 2)
  if (!shouldRewrite(pathnamePart)) return trimmed

  const query = queryPart ? `?${queryPart}` : ''
  return `${baseUrl}${pathnamePart}${query}`
}

/** 仅用于测试与同步脚本：暴露白名单。 */
export const REWRITTEN_ASSET_PREFIXES = REMOTE_ASSET_PREFIXES
