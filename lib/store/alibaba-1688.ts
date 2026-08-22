import { createHmac } from 'node:crypto'

import { logger } from '@/lib/logger'

const DEFAULT_ORIGIN = 'https://gw.open.1688.com'
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_TIMEOUT_MS = 60_000

export type Alibaba1688Params = Record<string, unknown>

export type Alibaba1688TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number | string
  memberId?: string
  resource_owner?: string
  [key: string]: unknown
}

export type Alibaba1688ClientOptions = {
  appKey?: string
  appSecret?: string
  redirectUri?: string
  origin?: string
  timeoutMs?: number
}

export class Alibaba1688Error extends Error {
  status?: number
  code?: string
  details?: unknown

  constructor({
    message,
    status,
    code,
    details,
  }: {
    message: string
    status?: number
    code?: string
    details?: unknown
  }) {
    super(message)
    this.name = 'Alibaba1688Error'
    this.status = status
    this.code = code
    this.details = details
  }
}

function getTimeoutMs(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(1_000, Math.round(value as number)))
}

function stringifyParam(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null || value === undefined) return ''
  return JSON.stringify(value)
}

/**
 * 1688 AOP 的签名输入：去掉签名自身后按参数名排序，拼接到请求路径后
 * 使用 appSecret 做 HMAC-SHA1，并转成大写十六进制。
 */
export function computeAlibaba1688Signature(
  requestPath: string,
  params: Alibaba1688Params,
  appSecret: string,
) {
  const canonicalParams = Object.entries(params)
    .filter(([key, value]) => key !== '_aop_signature' && value !== undefined && value !== null)
    .map(([key, value]) => [key, stringifyParam(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}${value}`)
    .join('')

  return createHmac('sha1', appSecret)
    .update(`${requestPath}${canonicalParams}`)
    .digest('hex')
    .toUpperCase()
}

function originFrom(value: string | undefined) {
  const origin = value?.trim() || DEFAULT_ORIGIN
  const parsed = new URL(origin)
  if (parsed.protocol !== 'https:') {
    throw new Alibaba1688Error({ message: '1688 API origin must use HTTPS' })
  }
  return parsed.origin
}

function envConfig(): Required<Pick<Alibaba1688ClientOptions, 'appKey' | 'appSecret' | 'redirectUri'>> & {
  origin: string
  timeoutMs: number
} {
  return {
    appKey: process.env.ALIBABA_1688_APP_KEY?.trim() || '',
    appSecret: process.env.ALIBABA_1688_APP_SECRET?.trim() || '',
    redirectUri: process.env.ALIBABA_1688_REDIRECT_URI?.trim() || '',
    origin: originFrom(process.env.ALIBABA_1688_API_ORIGIN),
    timeoutMs: getTimeoutMs(Number(process.env.ALIBABA_1688_TIMEOUT_MS)),
  }
}

export function isAlibaba1688Configured() {
  const config = envConfig()
  return Boolean(config.appKey && config.appSecret && config.redirectUri)
}

export function getAlibaba1688Config() {
  const config = envConfig()
  return {
    ...config,
    configured: Boolean(config.appKey && config.appSecret && config.redirectUri),
  }
}

export class Alibaba1688Client {
  private readonly appKey: string
  private readonly appSecret: string
  private readonly redirectUri: string
  private readonly origin: string
  private readonly timeoutMs: number

  constructor(options: Alibaba1688ClientOptions = {}) {
    const config = envConfig()
    this.appKey = options.appKey?.trim() || config.appKey
    this.appSecret = options.appSecret?.trim() || config.appSecret
    this.redirectUri = options.redirectUri?.trim() || config.redirectUri
    this.origin = originFrom(options.origin || config.origin)
    this.timeoutMs = getTimeoutMs(options.timeoutMs || config.timeoutMs)
  }

  getAuthorizationUrl(state: string, options: { scope?: string } = {}) {
    if (!this.appKey || !this.redirectUri) {
      throw new Alibaba1688Error({ message: '1688 OAuth is not configured' })
    }

    const url = new URL('https://auth.1688.com/oauth/authorize')
    url.searchParams.set('client_id', this.appKey)
    url.searchParams.set('site', '1688')
    url.searchParams.set('redirect_uri', this.redirectUri)
    url.searchParams.set('state', state)
    if (options.scope) url.searchParams.set('scope', options.scope)
    return url.toString()
  }

  async exchangeCodeForTokens(code: string) {
    return this.requestToken('authorization_code', {
      code,
      need_refresh_token: 'true',
    })
  }

  async refreshAccessToken(refreshToken: string) {
    return this.requestToken('refresh_token', { refresh_token: refreshToken })
  }

  async execute<T = unknown>(
    api: string,
    params: Alibaba1688Params,
    accessToken: string,
    options: { idempotent?: boolean } = {},
  ): Promise<T> {
    if (!this.appKey || !this.appSecret) {
      throw new Alibaba1688Error({ message: '1688 API credentials are not configured' })
    }
    if (!accessToken.trim()) {
      throw new Alibaba1688Error({ message: '1688 access token is required' })
    }

    const apiName = api.replace(/^\/+|\/+$/g, '')
    // 1688 文档中的 API 名称通常是 `alibaba.trade.xxx`，部分旧文档写成
    // `alibaba/trade/xxx`；两种形式都允许，最终原样进入 AOP 路径。
    if (!apiName.includes('/') && !apiName.includes('.')) {
      throw new Alibaba1688Error({ message: '1688 API must be in namespace/name format' })
    }

    const requestPath = `/openapi/param2/1/${apiName}/${this.appKey}`
    const requestParams: Alibaba1688Params = {
      ...params,
      access_token: accessToken,
      _aop_timestamp: Date.now(),
    }
    requestParams._aop_signature = computeAlibaba1688Signature(
      `param2/1/${apiName}/${this.appKey}`,
      requestParams,
      this.appSecret,
    )

    return this.requestJson<T>({
      path: requestPath,
      method: 'POST',
      params: requestParams,
      idempotent: options.idempotent,
    })
  }

  private async requestToken(
    grantType: 'authorization_code' | 'refresh_token',
    extra: Record<string, string>,
  ): Promise<Alibaba1688TokenResponse> {
    if (!this.appKey || !this.appSecret) {
      throw new Alibaba1688Error({ message: '1688 API credentials are not configured' })
    }

    const url = new URL(`/openapi/http/1/system.oauth2/getToken/${this.appKey}`, this.origin)
    url.searchParams.set('grant_type', grantType)
    url.searchParams.set('client_id', this.appKey)
    url.searchParams.set('client_secret', this.appSecret)
    url.searchParams.set('redirect_uri', this.redirectUri)
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value)

    return this.requestJson<Alibaba1688TokenResponse>({
      url: url.toString(),
      method: 'POST',
      idempotent: grantType === 'refresh_token',
    })
  }

  private async requestJson<T>({
    path,
    url: rawUrl,
    method,
    params,
    idempotent = false,
  }: {
    path?: string
    url?: string
    method: 'POST' | 'GET'
    params?: Alibaba1688Params
    idempotent?: boolean
  }): Promise<T> {
    const url = new URL(rawUrl || path || '/', this.origin)
    const body = params
      ? new URLSearchParams(
          Object.entries(params).reduce<Record<string, string>>((result, [key, value]) => {
            if (value !== undefined && value !== null) result[key] = stringifyParam(value)
            return result
          }, {}),
        ).toString()
      : undefined

    for (let attempt = 0; attempt <= (idempotent ? 1 : 0); attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        const response = await fetch(url, {
          method,
          headers: body ? { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' } : undefined,
          body: method === 'POST' ? body : undefined,
          signal: controller.signal,
          cache: 'no-store',
        })
        const raw = await response.text()
        let payload: unknown
        try {
          payload = raw ? JSON.parse(raw) : null
        } catch {
          payload = raw
        }

        if (!response.ok) {
          if (idempotent && attempt === 0 && (response.status === 429 || response.status >= 500)) continue
          throw new Alibaba1688Error({
            message: `1688 API request failed (${response.status})`,
            status: response.status,
            details: payload,
          })
        }

        if (payload && typeof payload === 'object') {
          const record = payload as Record<string, unknown>
          if (record.success === false || record.error_response) {
            throw new Alibaba1688Error({
              message: String(record.message || record.error_message || '1688 API returned an error'),
              code: String(record.code || record.error_code || ''),
              details: payload,
            })
          }
        }
        return payload as T
      } catch (error) {
        if (error instanceof Alibaba1688Error) throw error
        if (idempotent && attempt === 0) continue
        const message = error instanceof Error && error.name === 'AbortError'
          ? '1688 API request timed out'
          : 'Unable to reach 1688 API'
        logger.warn(message, { api: path || url.pathname })
        throw new Alibaba1688Error({ message, details: error })
      } finally {
        clearTimeout(timer)
      }
    }

    throw new Alibaba1688Error({ message: '1688 API request failed' })
  }
}
