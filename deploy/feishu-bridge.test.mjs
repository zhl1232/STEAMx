import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startFeishuBridge } from './feishu-bridge.mjs'

const env = { FEISHU_BRIDGE_ENABLED: 'true', FEISHU_APP_ID: 'cli_0123456789abcdef', FEISHU_APP_SECRET: 'private-app-secret' }
const event = () => ({
  event_id: 'event-1', app_id: env.FEISHU_APP_ID, tenant_key: 'tenant-1', unused: 'not-forwarded',
  sender: { sender_type: 'user', tenant_key: 'tenant-1', sender_id: { open_id: 'ou_staff', user_id: 'not-forwarded' } },
  message: { message_id: 'om_reply', parent_id: 'om_anchor', root_id: 'om_root', chat_id: 'oc_group', chat_type: 'group', message_type: 'text', content: '{"text":"@bot reply"}', mentions: [{ key: '@bot', id: { open_id: 'ou_bot', user_id: 'not-forwarded' }, name: 'not-forwarded' }], create_time: '123', extra: 'not-forwarded' },
})
function fixture() {
  const state = { imported: 0, constructed: 0, closed: 0 }
  class EventDispatcher {
    constructor(options) { state.dispatcherOptions = options }
    register(handlers) { state.handlers = handlers; return this }
  }
  class WSClient {
    constructor(options) { state.constructed++; state.options = options }
    async start({ eventDispatcher }) { state.started = eventDispatcher }
    close(options) { state.closed++; state.closeOptions = options }
    getConnectionStatus() { return 'connected' }
  }
  return { state, sdkFactory: async () => { state.imported++; return { EventDispatcher, WSClient, Domain: { Feishu: 'feishu' }, LoggerLevel: { error: 4 } } } }
}
const options = { baseUrl: 'http://localhost:3000', secret: 'internal-only', env }

test('missing or disabled credentials do not import SDK or open a connection', async () => {
  for (const overrides of [{ FEISHU_BRIDGE_ENABLED: 'false' }, { FEISHU_APP_ID: '' }, { FEISHU_APP_SECRET: '' }]) {
    const { state, sdkFactory } = fixture()
    const handle = await startFeishuBridge({ ...options, env: { ...env, ...overrides }, sdkFactory })
    assert.equal(handle.disabled, true)
    assert.equal(state.imported, 0)
    assert.equal(state.constructed, 0)
  }
})

test('valid group text forwards only approved fields and authenticates durable internal handoff', async () => {
  const { state, sdkFactory } = fixture()
  const requests = []
  const handle = await startFeishuBridge({ ...options, sdkFactory, fetchImpl: async (url, init) => { requests.push({ url: String(url), init }); return new Response('{}') } })
  await state.handlers['im.message.receive_v1'](event())
  assert.equal(requests[0].url, 'http://localhost:3000/api/internal/support/feishu/events')
  assert.equal(requests[0].init.headers.authorization, 'Bearer internal-only')
  assert.equal(requests[0].init.redirect, 'error')
  assert.ok(requests[0].init.signal instanceof AbortSignal)
  const body = JSON.parse(requests[0].init.body)
  assert.equal(body.event_id, 'event-1')
  assert.equal(body.message.parent_id, 'om_anchor')
  assert.equal(body.sender.sender_id.open_id, 'ou_staff')
  assert.deepEqual(body.message.mentions, [{ key: '@bot', id: { open_id: 'ou_bot' } }])
  assert.equal(requests[0].init.body.includes('not-forwarded'), false)
  assert.equal(handle.getStatus(), 'connected')
  handle.stop()
})

test('unsupported bot, private chat, and file events are acknowledged without forwarding', async () => {
  const { state, sdkFactory } = fixture()
  let calls = 0
  const handle = await startFeishuBridge({ ...options, sdkFactory, fetchImpl: async () => { calls++; return new Response('{}') } })
  for (const mutate of [e => { e.sender.sender_type = 'app' }, e => { e.message.chat_type = 'p2p' }, e => { e.message.message_type = 'file' }]) {
    const data = event(); mutate(data)
    await state.handlers['im.message.receive_v1'](data)
  }
  assert.equal(calls, 0)
  handle.stop()
})

test('HTTP rejection or network failure rejects the handler so the SDK returns a failed ack', async () => {
  for (const fetchImpl of [async () => new Response('{}', { status: 503 }), async () => { throw new Error('secret-provider-payload') }]) {
    const { state, sdkFactory } = fixture()
    const handle = await startFeishuBridge({ ...options, sdkFactory, fetchImpl })
    await assert.rejects(state.handlers['im.message.receive_v1'](event()), error => error.message === 'Feishu event persistence failed' && !String(error).includes('secret-provider-payload'))
    handle.stop()
  }
})

test('forwarding is bounded to two seconds and times out with a retryable failure', async () => {
  const { state, sdkFactory } = fixture()
  let timeoutSeen = false
  const handle = await startFeishuBridge({ ...options, sdkFactory, fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => resolve(new Response('{}')), 5000)
    signal.addEventListener('abort', () => { clearTimeout(keepAlive); timeoutSeen = true; reject(signal.reason) }, { once: true })
  }) })
  await assert.rejects(state.handlers['im.message.receive_v1'](event()), /Feishu event persistence failed/)
  assert.equal(timeoutSeen, true)
  handle.stop()
})

test('shutdown closes the SDK exactly once and rejects later events', async () => {
  const { state, sdkFactory } = fixture()
  const controller = new AbortController()
  const handle = await startFeishuBridge({ ...options, sdkFactory, signal: controller.signal })
  controller.abort()
  handle.stop()
  assert.equal(state.closed, 1)
  assert.deepEqual(state.closeOptions, { force: true })
  assert.equal(handle.getStatus(), 'closed')
  await assert.rejects(state.handlers['im.message.receive_v1'](event()), /persistence interrupted/)
})

test('an already aborted worker never imports the SDK', async () => {
  const { state, sdkFactory } = fixture()
  const controller = new AbortController(); controller.abort()
  const handle = await startFeishuBridge({ ...options, sdkFactory, signal: controller.signal })
  assert.equal(handle.disabled, true)
  assert.equal(state.imported, 0)
})

test('SDK logger consumes sensitive diagnostics without printing and startup errors are sanitized', async () => {
  const { state, sdkFactory } = fixture()
  const handle = await startFeishuBridge({ ...options, sdkFactory })
  const original = console.error
  let logs = 0
  console.error = () => { logs++ }
  try { for (const logger of [state.options.logger, state.dispatcherOptions.logger]) for (const method of Object.values(logger)) method('secret', event()) }
  finally { console.error = original; handle.stop() }
  assert.equal(logs, 0)
  await assert.rejects(startFeishuBridge({ ...options, sdkFactory: async () => { throw new Error('private-app-secret') } }), /^Error: Feishu bridge SDK could not be loaded$/)
})

test('real EventDispatcher flattens the official v2 event envelope before forwarding', async () => {
  const sdk = await import('@larksuiteoapi/node-sdk')
  const { state, sdkFactory } = fixture()
  const fake = await sdkFactory()
  const requests = []
  const handle = await startFeishuBridge({ ...options, sdkFactory: async () => ({ ...fake, EventDispatcher: sdk.EventDispatcher }), fetchImpl: async (_url, init) => { requests.push(JSON.parse(init.body)); return new Response('{}') } })
  const flattened = event()
  await state.started.invoke({ schema: '2.0', header: { event_type: 'im.message.receive_v1', event_id: flattened.event_id, app_id: flattened.app_id, tenant_key: flattened.tenant_key }, event: { sender: flattened.sender, message: flattened.message } }, { needCheck: false })
  assert.equal(requests[0].event_id, 'event-1')
  assert.equal(requests[0].app_id, env.FEISHU_APP_ID)
  handle.stop()
})

test('group image and rich-post events persist only whitelisted metadata', async () => {
  const { state, sdkFactory } = fixture()
  const requests = []
  const handle = await startFeishuBridge({ ...options, sdkFactory, fetchImpl: async (_url, init) => { requests.push(JSON.parse(init.body)); return new Response('{}') } })
  for (const message_type of ['image', 'post']) {
    const data = event()
    data.message.message_type = message_type
    data.message.content = JSON.stringify(message_type === 'image' ? { image_key: 'img_safe' } : { content: [[{ tag: 'img', image_key: 'img_safe' }]] })
    await state.handlers['im.message.receive_v1'](data)
  }
  assert.deepEqual(requests.map(item => item.message.message_type), ['image', 'post'])
  assert.equal(JSON.stringify(requests).includes('not-forwarded'), false)
  const oversized = event(); oversized.message.content = 'x'.repeat(33 * 1024)
  await assert.rejects(state.handlers['im.message.receive_v1'](oversized), /exceeds persistence limit/)
  assert.equal(requests.length, 2)
  handle.stop()
})
