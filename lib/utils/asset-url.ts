/**
 * 统一把仓库历史保留的本地资源路径（如 /birds/images/xxx.jpg、/birds/audio/xxx.ogg）重写为对象存储 URL。
 *
 * 设计原则：
 * - 只重写白名单前缀，避免误伤 /assets、/scratch、用户上传等路径
 * - 已是 http(s) 完整 URL 的直接放行
 * - 未配置 base URL（如开发环境）时返回原值，让本地 public/ 目录兜底
 */

const REMOTE_ASSET_PREFIXES = [
  '/birds/',
  '/insects/',
  '/trees/',
  '/projects/',
] as const

function getAssetsBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_ASSETS_BASE_URL
  if (!raw) return null

  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed || null
}

function shouldRewrite(pathname: string): boolean {
  return REMOTE_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
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
