import { isSafeInternalHref } from '@/lib/utils/safe-internal-href'

/** 客服不是公众号订阅；兼容已保存在欢迎配置中的旧地址。 */
export const PLATFORM_SUPPORT_HREF = '/support'
export const STORE_SUPPORT_HREF = '/store/support'

export function resolveSupportHref(value: unknown): string {
  if (typeof value !== 'string' || !isSafeInternalHref(value)) return PLATFORM_SUPPORT_HREF
  if (['/about#support', '/settings/about#support', '/about#contact', '/settings/about#contact'].includes(value)) return PLATFORM_SUPPORT_HREF
  return value
}
