import { isSafeInternalHref } from '@/lib/utils/safe-internal-href'

/** 客服不是公众号订阅；兼容已保存在欢迎配置中的旧地址。 */
export const PLATFORM_SUPPORT_HREF = '/about#support'

export function resolveSupportHref(value: unknown): string {
  if (typeof value !== 'string' || !isSafeInternalHref(value)) return PLATFORM_SUPPORT_HREF
  if (value === '/about#contact' || value === '/settings/about#contact') return PLATFORM_SUPPORT_HREF
  return value
}
