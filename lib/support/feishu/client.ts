import 'server-only'
import { createHash } from 'node:crypto'
import { FeishuBridgeError, feishuId, type FeishuConfig } from './config'

type ApiResult = { code?: number; tenant_access_token?: string; expire?: number; bot?: { open_id?: string }; data?: { message_id?: string } }

export class FeishuClient {
  private token?: { value: string; expires: number }
  private tokenPending?: Promise<string>
  private botId?: string
  constructor(private config: Pick<FeishuConfig, 'appId' | 'appSecret'>, private fetchImpl: typeof fetch = fetch) {}
  private async request(path: string, init: RequestInit, signal?: AbortSignal): Promise<ApiResult> {
    try {
      const timeout = AbortSignal.timeout(8000)
      const response = await this.fetchImpl(`https://open.feishu.cn/open-apis${path}`, { ...init, redirect: 'error', signal: signal ? AbortSignal.any([timeout, signal]) : timeout })
      if (!response.ok) throw new Error()
      const result = await response.json() as ApiResult
      if (!result || result.code !== 0) throw new Error()
      return result
    } catch { throw new FeishuBridgeError('feishu_unavailable') }
  }
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return this.token.value
    if (!this.tokenPending) this.tokenPending = (async () => {
      const result = await this.request('/auth/v3/tenant_access_token/internal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ app_id: this.config.appId, app_secret: this.config.appSecret }) })
      if (typeof result.tenant_access_token !== 'string' || !result.tenant_access_token || typeof result.expire !== 'number' || result.expire <= 60 || result.expire > 86400) throw new FeishuBridgeError('feishu_token_invalid')
      this.token = { value: result.tenant_access_token, expires: Date.now() + (result.expire - 60) * 1000 }
      return this.token.value
    })().finally(() => { this.tokenPending = undefined })
    return this.tokenPending
  }
  async botOpenId(): Promise<string> {
    if (this.botId) return this.botId
    const token = await this.accessToken()
    const result = await this.request('/bot/v3/info', { method: 'GET', headers: { authorization: `Bearer ${token}` } })
    if (!feishuId(result.bot?.open_id, 'ou_')) throw new FeishuBridgeError('feishu_bot_invalid')
    return this.botId = result.bot.open_id
  }
  async sendText(chatId: string, text: string, eventId: string, targetId: string, signal?: AbortSignal): Promise<string> {
    if (!feishuId(chatId, 'oc_') || text.length > 12000) throw new FeishuBridgeError('feishu_message_invalid')
    const token = await this.accessToken()
    const uuid = createHash('sha256').update(`${eventId}\0${targetId}`).digest('hex').slice(0, 32)
    // Feishu text parses <at ...> markup; site-authored content must remain plain text.
    const plainText = text.replace(/</g, '＜')
    const result = await this.request('/im/v1/messages?receive_id_type=chat_id', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: plainText }), uuid }) }, signal)
    if (!feishuId(result.data?.message_id, 'om_')) throw new FeishuBridgeError('feishu_message_invalid')
    return result.data.message_id
  }
}

let cached: { identity: string; client: FeishuClient } | undefined
export function getFeishuClient(config: FeishuConfig): FeishuClient {
  const identity = createHash('sha256').update(`${config.appId}\0${config.appSecret}`).digest('hex')
  if (!cached || cached.identity !== identity) cached = { identity, client: new FeishuClient(config) }
  return cached.client
}
