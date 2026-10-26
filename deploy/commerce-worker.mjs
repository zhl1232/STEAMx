import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { startFeishuBridge } from './feishu-bridge.mjs'

export async function runFeishuTick({ baseUrl, secret, signal, fetchImpl = fetch }) {
  const response = await fetchImpl(new URL('/api/internal/support/feishu/dispatch', baseUrl), {
    method: 'POST',
    redirect: 'error',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: '{}',
  })
  if (!response.ok) throw new Error(`Feishu dispatch HTTP ${response.status}`)
  return response.json()
}

async function runFeishuLoop({ baseUrl, secret, signal }) {
  if (process.env.FEISHU_BRIDGE_ENABLED !== 'true') return
  let bridge
  let lastFailure = false
  let lastConnectionState = ''
  try {
    while (!signal.aborted) {
      try {
        if (!bridge) bridge = await startFeishuBridge({ baseUrl, secret, signal })
        const connection = bridge.getStatus()
        const state = typeof connection === 'string' ? connection : connection?.state
        if (['starting','connecting','connected','reconnecting','failed','closed','disabled'].includes(state) && state !== lastConnectionState) {
          console.info(`Feishu connection: ${state}`)
          lastConnectionState = state
        }
        if (state === 'failed') {
          bridge.stop()
          bridge = undefined
          throw new Error('Feishu connection failed')
        }
        const result = await runFeishuTick({ baseUrl, secret, signal })
        const failed = Number(result.failed || 0) > 0
        if (failed && !lastFailure) console.warn('Feishu dispatch has pending failures; check service configuration')
        lastFailure = failed
      } catch {
        if (!signal.aborted && !lastFailure) console.warn('Feishu bridge unavailable; retrying without interrupting commerce tasks')
        lastFailure = true
      }
      try { await delay(lastFailure ? 30_000 : 5_000, undefined, { signal }) } catch { break }
    }
  } finally { bridge?.stop() }
}

/** Both durable queues run independently; one failing channel cannot starve the other. */
export async function runCommerceTick({ baseUrl, secret, signal, fetchImpl = fetch }) {
  return Promise.allSettled(['store/reconcile', 'support/notifications'].map(async endpoint => {
    const response = await fetchImpl(new URL(`/api/internal/${endpoint}`, baseUrl), {
      method: 'POST',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 20 }),
    })
    if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`)
    const result = await response.json()
    return { endpoint, result }
  }))
}

async function main() {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if (!secret) throw new Error('Missing CRON_SECRET or INTERNAL_API_SECRET')
  const baseUrl = process.env.COMMERCE_WORKER_BASE_URL || 'http://steam-app:3000'
  const configuredInterval = Number(process.env.COMMERCE_WORKER_INTERVAL_SECONDS || 60)
  const interval = Number.isFinite(configuredInterval) ? Math.max(10, configuredInterval) : 60
  const stop = new AbortController()
  process.once('SIGINT', () => stop.abort())
  process.once('SIGTERM', () => stop.abort())
  const feishuTask = runFeishuLoop({ baseUrl, secret, signal: stop.signal })
  while (!stop.signal.aborted) {
    const results = await runCommerceTick({ baseUrl, secret, signal: stop.signal })
    for (const result of results) {
      if (result.status === 'rejected' && !stop.signal.aborted) console.error('commerce worker', result.reason.message)
      else if (result.status === 'fulfilled') {
        const needsAttention = result.value.result?.failed
        if (Array.isArray(needsAttention) && needsAttention.length) console.warn('commerce reconciliation needs attention', needsAttention)
      }
    }
    try { await delay(interval * 1000, undefined, { signal: stop.signal }) } catch { break }
  }
  await feishuTask
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
