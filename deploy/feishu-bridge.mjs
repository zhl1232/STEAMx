const silentLogger = Object.freeze({
  trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
})

/** SDK diagnostics may contain entire events, so they never enter worker logs. */
function transportEvent(event) {
  const sender = event?.sender
  const message = event?.message
  if (sender?.sender_type !== 'user' || message?.message_type !== 'text' || message?.chat_type !== 'group') return null
  return {
    event_id: event.event_id,
    app_id: event.app_id,
    tenant_key: event.tenant_key,
    sender: {
      sender_id: { open_id: sender.sender_id?.open_id },
      sender_type: sender.sender_type,
      tenant_key: sender.tenant_key,
    },
    message: {
      message_id: message.message_id,
      parent_id: message.parent_id,
      root_id: message.root_id,
      chat_id: message.chat_id,
      chat_type: message.chat_type,
      message_type: message.message_type,
      content: message.content,
      mentions: Array.isArray(message.mentions) ? message.mentions.slice(0, 50).map(mention => ({
        key: mention?.key,
        id: { open_id: mention?.id?.open_id },
      })) : [],
      create_time: message.create_time,
    },
  }
}

/** Only the trusted SDK socket can invoke this handler; it is not a public webhook. */
export async function startFeishuBridge({
  baseUrl, secret, signal, env = process.env, fetchImpl = fetch,
  sdkFactory = () => import('@larksuiteoapi/node-sdk'),
}) {
  const disabled = { disabled: true, stop() {}, getStatus: () => 'disabled' }
  if (env.FEISHU_BRIDGE_ENABLED !== 'true' || !env.FEISHU_APP_ID?.trim() || !env.FEISHU_APP_SECRET?.trim()) return disabled
  if (signal?.aborted) return disabled
  const appId = env.FEISHU_APP_ID.trim()
  if (!/^cli_[0-9a-fA-F]{16}$/.test(appId) || !secret) throw new Error('Feishu bridge configuration is invalid')
  let endpoint
  try {
    const origin = new URL(baseUrl)
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error()
    endpoint = new URL('/api/internal/support/feishu/events', origin)
  } catch { throw new Error('Feishu bridge endpoint is invalid') }

  let sdk
  try { sdk = await sdkFactory() } catch { throw new Error('Feishu bridge SDK could not be loaded') }
  if (signal?.aborted) return disabled
  let client
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    signal?.removeEventListener('abort', stop)
    // SDK close also destroys heartbeat, reconnect and fragment-cache timers.
    try { client?.close({ force: true }) } catch { /* No sensitive SDK errors in logs. */ }
  }
  try {
    const dispatcher = new sdk.EventDispatcher({ logger: silentLogger, loggerLevel: sdk.LoggerLevel?.error })
    dispatcher.register({
      'im.message.receive_v1': async event => {
        const payload = transportEvent(event)
        if (!payload) return
        if (stopped || signal?.aborted) throw new Error('Feishu event persistence interrupted')
        const body = JSON.stringify(payload)
        if (Buffer.byteLength(body) > 32 * 1024) throw new Error('Feishu event exceeds persistence limit')
        try {
          const timeout = AbortSignal.timeout(2000)
          const response = await fetchImpl(endpoint, {
            method: 'POST',
            redirect: 'error',
            headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
            body,
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          })
          if (!response.ok) throw new Error()
        } catch {
          // The SDK sends code=500 when this throws; only durable 2xx is acknowledged.
          throw new Error('Feishu event persistence failed')
        }
      },
    })
    client = new sdk.WSClient({
      appId,
      appSecret: env.FEISHU_APP_SECRET.trim(),
      domain: sdk.Domain?.Feishu,
      logger: silentLogger,
      loggerLevel: sdk.LoggerLevel?.error,
    })
    signal?.addEventListener('abort', stop, { once: true })
    if (signal?.aborted) { stop(); return disabled }
    await client.start({ eventDispatcher: dispatcher })
    return {
      disabled: false,
      stop,
      getStatus: () => stopped ? 'closed' : (client.getConnectionStatus?.() ?? 'starting'),
    }
  } catch {
    stop()
    throw new Error('Feishu bridge could not start')
  }
}
