/**
 * 统一把仓库历史保留的本地资源路径（如 /birds/images/xxx.jpg、/birds/audio/xxx.ogg）重写为对象存储 URL。
 *
 * 设计原则：
 * - 只重写白名单前缀，避免误伤 /assets、/scratch、用户上传等路径
 * - 已是 http(s) 完整 URL 的直接放行
 * - 配置 base URL 后各环境先统一解析为同一资源域名
 * - 生产环境直接输出资源域名；开发环境默认经 /api/assets 代理，以生产 Referer 模拟 CDN 防盗链
 * - 开发态如需直连资源域名排查，可显式设置 NEXT_PUBLIC_ASSETS_DISPLAY_MODE=direct
 */

const REMOTE_ASSET_PREFIXES = [
  '/birds/',
  '/insects/',
  '/trees/',
  '/fruits/',
  '/projects/',
] as const

export function getAssetsBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_ASSETS_BASE_URL
  if (!raw) return null

  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed || null
}

function shouldRewrite(pathname: string): boolean {
  return REMOTE_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
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

  return getConfiguredAssetPath(input) !== null
}

export function shouldBypassAssetImageOptimization(input: string | null | undefined): boolean {
  return isConfiguredAssetUrl(input)
}

function shouldProxyConfiguredAssets() {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ASSETS_DISPLAY_MODE !== 'direct'
}

export function getAssetDisplayUrl(input: string | null | undefined): string | null | undefined {
  if (input == null) return input
  if (typeof input !== 'string') return input

  const trimmed = input.trim()
  if (!trimmed || !shouldProxyConfiguredAssets()) return input

  const assetPath = getConfiguredAssetPath(trimmed)
  if (!assetPath) return input

  const sourceUrl = new URL(trimmed)
  return `/api/assets${assetPath}${sourceUrl.search}`
}

/**
 * 展示用资源 URL：先把 `/birds/...` 等本地路径重写到 CDN，再在开发环境走 `/api/assets` 代理。
 */
export function resolveAssetDisplayUrl(input: string | null | undefined): string | null | undefined {
  if (input == null) return input
  if (typeof input !== 'string') return input

  const trimmed = input.trim()
  if (!trimmed) return input

  const rewritten = rewriteAssetUrl(trimmed) ?? trimmed
  return getAssetDisplayUrl(rewritten) ?? rewritten
}

export function shouldBypassAssetDisplayOptimization(input: string | null | undefined): boolean {
  if (!input || typeof input !== 'string') return false
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
