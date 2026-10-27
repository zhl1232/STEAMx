import 'server-only'
import { createHash } from 'node:crypto'
import { imageMime } from '../validation'
import { validImageKey } from './message-content'
import { FeishuBridgeError, feishuId, type FeishuConfig } from './config'

type ApiResult = { code?: number; tenant_access_token?: string; expire?: number; bot?: { open_id?: string }; data?: { message_id?: string; image_key?: string } }

export class FeishuClient {
  private token?: { value: string; expires: number }
  private tokenPending?: Promise<string>
  private botId?: string
  constructor(private config: Pick<FeishuConfig, 'appId' | 'appSecret'>, private fetchImpl: typeof fetch = fetch) {}
  private async request(path: string, init: RequestInit, signal?: AbortSignal): Promise<ApiResult> {
    try {
      if (typeof init.body === 'string' && Buffer.byteLength(init.body, 'utf8') > 30000) throw new Error()
      const timeout = AbortSignal.timeout(8000)
      const response = await this.fetchImpl(`https://open.feishu.cn/open-apis${path}`, { ...init, redirect: 'error', signal: signal ? AbortSignal.any([timeout, signal]) : timeout })
      if (!response.ok) throw new Error()
      const result = await response.json() as ApiResult
      if (!result || result.code !== 0) throw new Error()
      return result
    } catch { throw new FeishuBridgeError('feishu_unavailable') }
  }
  private async accessToken(signal?: AbortSignal): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return this.token.value
    if (!this.tokenPending) this.tokenPending = (async () => {
      const result = await this.request('/auth/v3/tenant_access_token/internal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ app_id: this.config.appId, app_secret: this.config.appSecret }) }, signal)
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
  async uploadImage(bytes: Uint8Array, signal?: AbortSignal): Promise<string> {
    let mime: ReturnType<typeof imageMime>
    try { mime = imageMime(bytes) } catch { throw new FeishuBridgeError('feishu_image_invalid', 400) }
    const token = await this.accessToken(signal)
    const body = new FormData()
    body.set('image_type', 'message')
    body.set('image', new Blob([new Uint8Array(bytes)], { type: mime }), `image.${mime.split('/')[1]}`)
    const result = await this.request('/im/v1/images', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body }, signal)
    if (!validImageKey(result.data?.image_key)) throw new FeishuBridgeError('feishu_image_invalid')
    return result.data.image_key
  }
  async downloadImage(messageId: string, imageKey: string, signal?: AbortSignal): Promise<Uint8Array> {
    if (!feishuId(messageId, 'om_') || !validImageKey(imageKey)) throw new FeishuBridgeError('feishu_image_invalid', 400)
    const token = await this.accessToken(signal)
    try {
      const timeout = AbortSignal.timeout(8000)
      const requestSignal = signal ? AbortSignal.any([timeout, signal]) : timeout
      requestSignal.throwIfAborted()
      const response = await this.fetchImpl(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/${imageKey}?type=image`, { method: 'GET', headers: { authorization: `Bearer ${token}` }, redirect: 'error', signal: requestSignal })
      const limit = 5 * 1024 * 1024
      if (!response.ok || !response.body) {
        await response.body?.cancel()
        throw new Error()
      }
      if (Number(response.headers.get('content-length')) > limit) {
        await response.body.cancel()
        throw new FeishuBridgeError('feishu_image_invalid', 400)
      }
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      const abort = () => { void reader.cancel().catch(() => {}) }
      requestSignal.addEventListener('abort', abort, { once: true })
      try {
        while (true) {
          requestSignal.throwIfAborted()
          const { done, value } = await reader.read()
          requestSignal.throwIfAborted()
          if (done) break
          size += value.byteLength
          if (size > limit) throw new FeishuBridgeError('feishu_image_invalid', 400)
          chunks.push(value)
        }
      } finally {
        requestSignal.removeEventListener('abort', abort)
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      try { imageMime(bytes) } catch { throw new FeishuBridgeError('feishu_image_invalid', 400) }
      return bytes
    } catch (error) {
      if (error instanceof FeishuBridgeError && error.code === 'feishu_image_invalid') throw error
      throw new FeishuBridgeError('feishu_image_unavailable')
    }
  }
  async sendPost(chatId: string, text: string, imageKeys: string[], eventId: string, targetId: string, signal?: AbortSignal, rootId?: string): Promise<string> {
    if (!feishuId(chatId, 'oc_') || text.length > 12000 || imageKeys.length > 3 || imageKeys.some(key => !validImageKey(key))) throw new FeishuBridgeError('feishu_message_invalid', 400)
    const uuid = createHash('sha256').update(rootId ? `reply\0${rootId}\0${eventId}\0${targetId}` : `${eventId}\0${targetId}`).digest('hex').slice(0, 32)
    const content = JSON.stringify({ zh_cn: { content: [[{ tag: 'text', text }], ...imageKeys.map(image_key => [{ tag: 'img', image_key }])] } })
    if (rootId !== undefined && !feishuId(rootId, 'om_')) throw new FeishuBridgeError('feishu_message_invalid', 400)
    const body = JSON.stringify({ ...(rootId ? { reply_in_thread: true } : { receive_id: chatId }), msg_type: 'post', content, uuid })
    if (Buffer.byteLength(body, 'utf8') > 30000) throw new FeishuBridgeError('feishu_message_invalid', 400)
    const token = await this.accessToken(signal)
    const result = await this.request(rootId ? `/im/v1/messages/${rootId}/reply` : '/im/v1/messages?receive_id_type=chat_id', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body }, signal)
    if (!feishuId(result.data?.message_id, 'om_')) throw new FeishuBridgeError('feishu_message_invalid')
    return result.data.message_id
  }
  async sendText(chatId: string, text: string, eventId: string, targetId: string, signal?: AbortSignal, rootId?: string): Promise<string> {
    if (!feishuId(chatId, 'oc_') || text.length > 12000) throw new FeishuBridgeError('feishu_message_invalid')
    const token = await this.accessToken(signal)
    const uuid = createHash('sha256').update(rootId ? `reply\0${rootId}\0${eventId}\0${targetId}` : `${eventId}\0${targetId}`).digest('hex').slice(0, 32)
    // Feishu text parses <at ...> markup; site-authored content must remain plain text.
    if (rootId !== undefined && !feishuId(rootId, 'om_')) throw new FeishuBridgeError('feishu_message_invalid', 400)
    const plainText = text.replace(/</g, '＜')
    const result = await this.request(rootId ? `/im/v1/messages/${rootId}/reply` : '/im/v1/messages?receive_id_type=chat_id', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ ...(rootId ? { reply_in_thread: true } : { receive_id: chatId }), msg_type: 'text', content: JSON.stringify({ text: plainText }), uuid }) }, signal)
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
