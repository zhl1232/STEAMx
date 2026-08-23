/**
 * 外部商品购买链接的安全边界。
 *
 * 商品链接来自管理员配置，但仍会经过服务端公开目录接口；只允许淘宝/天猫
 * 的 HTTPS 链接，避免把商城目录变成任意开放重定向入口。
 */

export const STORE_CHECKOUT_MODES = ['internal', 'external'] as const
export type StoreCheckoutMode = (typeof STORE_CHECKOUT_MODES)[number]

export const STORE_EXTERNAL_CHANNELS = ['taobao'] as const
export type StoreExternalChannel = (typeof STORE_EXTERNAL_CHANNELS)[number]

const STORE_CONTEXT_KEY_PATTERN = /^(course|lesson|project):[A-Za-z0-9_-]{1,80}$/

const ALLOWED_HOSTS = new Set(['taobao.com', 'tmall.com', 'tb.cn'])

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return ALLOWED_HOSTS.has(host) || [...ALLOWED_HOSTS].some((root) => host.endsWith(`.${root}`))
}

/** Return a normalized URL only when it is a safe Taobao/Tmall HTTPS link. */
export function normalizeTaobaoUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value.trim())
    if (
      url.protocol !== 'https:' ||
      !isAllowedHost(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

export function isSupportedExternalChannel(value: unknown): value is StoreExternalChannel {
  return STORE_EXTERNAL_CHANNELS.includes(value as StoreExternalChannel)
}

export function isStoreContextKey(value: unknown): value is string {
  return typeof value === 'string' && STORE_CONTEXT_KEY_PATTERN.test(value.trim())
}

export function normalizeStoreContextKeys(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,，、]+/)
      : []

  return [...new Set(values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(isStoreContextKey))].slice(0, 24)
}
