import 'server-only'

export const FEISHU_EVENTS = ['support.user_message', 'support.admin_message', 'order.created', 'order.paid', 'order.refund_requested', 'order.refunded'] as const
export type FeishuEventKind = typeof FEISHU_EVENTS[number]
export type FeishuChannel = 'platform' | 'store'
export type FeishuTarget = { id: string; chatId: string; enabled: boolean; channels: FeishuChannel[]; events: FeishuEventKind[] }
export type FeishuStaff = { openId: string; profileId: string }
export type FeishuConfig = { appId: string; appSecret: string; tenantKey?: string; siteUrl?: string; targets: FeishuTarget[]; staff: FeishuStaff[] }

export class FeishuBridgeError extends Error {
  constructor(public code: string, public status = 503) { super(code) }
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
export function feishuId(value: unknown, prefix: 'om_' | 'oc_' | 'ou_'): value is string {
  return typeof value === 'string' && new RegExp(`^${prefix}[A-Za-z0-9_-]{1,125}$`).test(value)
}
function list(value: string | undefined): unknown[] {
  if (!value?.trim()) return []
  if (value.length > 32768) throw new Error()
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || parsed.length > 100) throw new Error()
  return parsed
}
function enumList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value) || !value.length || value.length > allowed.length || new Set(value).size !== value.length || value.some(item => !allowed.includes(item))) throw new Error()
  return value as T[]
}
export function getFeishuConfig(env: NodeJS.ProcessEnv = process.env): FeishuConfig | null {
  if (env.FEISHU_BRIDGE_ENABLED !== 'true') return null
  try {
    const appId = env.FEISHU_APP_ID?.trim()
    const appSecret = env.FEISHU_APP_SECRET?.trim()
    if (!appId || !/^cli_[0-9a-fA-F]{16}$/.test(appId) || !appSecret || appSecret.length > 1024) throw new Error()
    const targetIds = new Set<string>(), chatIds = new Set<string>(), openIds = new Set<string>()
    const targets = list(env.FEISHU_TARGETS_JSON).map(item => {
      if (!object(item) || typeof item.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(item.id) || !feishuId(item.chatId, 'oc_') || (item.enabled !== undefined && typeof item.enabled !== 'boolean') || targetIds.has(item.id) || chatIds.has(item.chatId)) throw new Error()
      targetIds.add(item.id); chatIds.add(item.chatId)
      return { id: item.id, chatId: item.chatId, enabled: item.enabled !== false, channels: enumList(item.channels, ['platform', 'store'] as const), events: enumList(item.events, FEISHU_EVENTS) }
    })
    if (targets.length > 50) throw new Error()
    const staff = list(env.FEISHU_STAFF_JSON).map(item => {
      if (!object(item) || !feishuId(item.openId, 'ou_') || typeof item.profileId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.profileId) || openIds.has(item.openId)) throw new Error()
      openIds.add(item.openId)
      return { openId: item.openId, profileId: item.profileId }
    })
    let siteUrl: string | undefined
    if (env.FEISHU_SITE_URL?.trim()) {
      const site = new URL(env.FEISHU_SITE_URL.trim())
      if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) throw new Error()
      siteUrl = site.origin
    }
    const tenantKey = env.FEISHU_TENANT_KEY?.trim() || undefined
    if (tenantKey && !/^[A-Za-z0-9_-]{1,128}$/.test(tenantKey)) throw new Error()
    return { appId, appSecret, tenantKey, siteUrl, targets, staff }
  } catch { throw new FeishuBridgeError('configuration_invalid') }
}

export function feishuHealth() {
  try {
    const config = getFeishuConfig()
    return { enabled: Boolean(config), configured: Boolean(config?.targets.some(target => target.enabled) && config.staff.length), targets: config?.targets.filter(target => target.enabled).length ?? 0, staff: config?.staff.length ?? 0 }
  } catch { return { enabled: process.env.FEISHU_BRIDGE_ENABLED === 'true', configured: false, targets: 0, staff: 0 } }
}
