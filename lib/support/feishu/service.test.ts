import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), sendText: vi.fn(), botOpenId: vi.fn(), validate: vi.fn(), moderate: vi.fn(), file: '', mode: 0,
}))
vi.mock('../server', () => ({ supportDb: () => ({ rpc: mock.rpc, from: mock.from }) }))
vi.mock('./client', () => ({ getFeishuClient: () => ({ sendText: mock.sendText, botOpenId: mock.botOpenId }) }))
vi.mock('@/lib/api/validation', () => ({ validateContentSafe: mock.validate }))
vi.mock('@/lib/safety/server', () => ({ moderateTextContent: mock.moderate }))
vi.mock('node:fs/promises', () => ({ open: vi.fn(async () => ({
  stat: async () => ({ size: Buffer.byteLength(mock.file) }), chmod: async (mode: number) => { mock.mode = mode },
  read: async (buffer: Buffer) => ({ bytesRead: Buffer.from(mock.file).copy(buffer) }),
  write: async (text: string, position: number) => { mock.file = mock.file.slice(0, position) + text }, sync: async () => {}, close: async () => {},
})) }))
import { enqueueFeishuEvent, readDiscovery, runFeishuDispatch } from './service'

const appId = 'cli_0123456789abcdef', profileId = '10000000-0000-4000-8000-000000000001'
const target = { id: 'store-team', chatId: 'oc_store', channels: ['store'], events: ['support.user_message', 'support.admin_message', 'order.created'], enabled: true }
const incoming = { message_id: 'om_reply', chat_id: 'oc_store', sender_open_id: 'ou_staff', parent_id: 'om_anchor', root_id: null, text: '已经为您安排补寄。', lease_id: 'lease-in', attempts: 1 }
const delivery = { event_id: 'event-one', target_id: 'store-team', lease_id: 'lease-out', attempts: 1, kind: 'support.user_message', support_message_id: 'support-message', order_event_id: null, chat_id: 'oc_store' }
function event(text = '@_bot 已经为您安排补寄。') {
  return { event_id: 'event-one', app_id: appId, tenant_key: 'tenant-one', sender: { sender_type: 'user', tenant_key: 'tenant-one', sender_id: { open_id: 'ou_staff' } }, message: { message_id: 'om_reply', chat_id: 'oc_store', chat_type: 'group', message_type: 'text', parent_id: 'om_anchor', root_id: null, mentions: [{ key: '@_bot', id: { open_id: 'ou_bot' } }], content: JSON.stringify({ text }) } }
}
type Result = { data?: unknown; error?: unknown; count?: number }
let resultFor: (table: string) => Result
function query(table: string) {
  const q = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => resultFor(table)), then: (resolve: (value: Result) => unknown) => Promise.resolve(resultFor(table)).then(resolve) }
  q.select.mockReturnValue(q); q.eq.mockReturnValue(q)
  return q
}
beforeEach(() => {
  vi.clearAllMocks(); mock.file = ''; mock.mode = 0
  vi.stubEnv('FEISHU_BRIDGE_ENABLED', 'true'); vi.stubEnv('FEISHU_APP_ID', appId); vi.stubEnv('FEISHU_APP_SECRET', 'private-secret'); vi.stubEnv('FEISHU_TENANT_KEY', ''); vi.stubEnv('FEISHU_SITE_URL', 'https://example.test')
  vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify([target])); vi.stubEnv('FEISHU_STAFF_JSON', JSON.stringify([{ openId: 'ou_staff', profileId }]))
  mock.botOpenId.mockResolvedValue('ou_bot'); mock.sendText.mockResolvedValue('om_delivered'); mock.moderate.mockReturnValue({ state: 'approved' })
  mock.rpc.mockImplementation(async (name: string) => ({ data: name.startsWith('feishu_claim_') ? [] : true, error: null }))
  resultFor = table => ({ data: table === 'profiles' ? { role: 'admin' } : table === 'support_messages' ? { content: '商品缺件', sender_role: 'user', conversation_id: 'conversation-one', phone: 'private-phone', address: 'private-address' } : table === 'support_conversations' ? { channel: 'store' } : table === 'store_order_events' ? { order_id: 'order-one' } : table === 'store_orders' ? { id: 'order-one', total_cents: 880, status: 'pending_payment', address_snapshot_encrypted: 'private-address', procurement_cost: 'private-cost' } : null, error: null, count: table === 'support_attachments' ? 1 : 0 })
  mock.from.mockImplementation(query)
})
afterEach(() => vi.unstubAllEnvs())
describe('Feishu service event boundaries', () => {
  it('returns disabled error before any bot or database access', async () => {
    vi.stubEnv('FEISHU_BRIDGE_ENABLED', 'false')
    await expect(enqueueFeishuEvent(event())).rejects.toThrow('bridge_disabled')
    expect(mock.botOpenId).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('rejects a cross-app or cross-tenant event before persisting it', async () => {
    await expect(enqueueFeishuEvent({ ...event(), app_id: 'cli_1111111111111111' })).rejects.toThrow('event_app_invalid')
    await expect(enqueueFeishuEvent({ ...event(), tenant_key: 'other' })).rejects.toThrow('event_tenant_invalid')
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('does not write unbound staff, unbound chat, non-mention, or unrelated group messages', async () => {
    const cases = [() => { const data = event(); data.sender.sender_id.open_id = 'ou_other'; return data }, () => { const data = event(); data.message.chat_id = 'oc_other'; return data }, () => { const data = event(); data.message.mentions = []; return data }, () => { const data = event(); data.message.parent_id = ''; return data }]
    for (const make of cases) expect(await enqueueFeishuEvent(make())).toEqual({ ignored: true })
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('durably enqueues only stripped text and stable source identifiers', async () => {
    expect(await enqueueFeishuEvent(event())).toEqual({ queued: true, duplicate: false })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_enqueue_inbound', { p_message_id: 'om_reply', p_chat_id: 'oc_store', p_sender_open_id: 'ou_staff', p_parent_id: 'om_anchor', p_root_id: null, p_text: '已经为您安排补寄。' })
  })
  it('rejects empty or oversized replies after stripping bot mentions', async () => {
    await expect(enqueueFeishuEvent(event('@_bot '))).rejects.toThrow('reply_content_invalid')
    await expect(enqueueFeishuEvent(event(`@_bot ${'字'.repeat(2001)}`))).rejects.toThrow('reply_content_invalid')
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('collects only binding candidates, securely and once, even before group/staff configuration', async () => {
    vi.stubEnv('FEISHU_TARGETS_JSON', '[]'); vi.stubEnv('FEISHU_STAFF_JSON', '[]')
    const data = event('@_bot 绑定客服'); data.message.parent_id = ''
    expect(await enqueueFeishuEvent(data)).toEqual({ discovered: true }); expect(await enqueueFeishuEvent(data)).toEqual({ discovered: true })
    const candidates = await readDiscovery()
    expect(candidates).toHaveLength(1); expect(candidates[0]).toEqual({ chatId: 'oc_store', openId: 'ou_staff', appId, recordedAt: expect.any(String) })
    expect(mock.mode).toBe(0o600); expect(mock.file).not.toContain('绑定客服'); expect(mock.file).not.toContain('private-secret'); expect(mock.rpc).not.toHaveBeenCalled()
  })
})
describe('Feishu durable dispatch', () => {
  it('applies an authorized reply then completes its lease', async () => {
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_inbound' ? [incoming] : name === 'feishu_claim_deliveries' ? [] : name === 'feishu_apply_reply' ? { message_id: 'site-reply' } : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ replies: 1, failed: 0 })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_apply_reply', expect.objectContaining({ p_actor: profileId, p_content: incoming.text }))
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_inbound', { p_message_id: incoming.message_id, p_lease: incoming.lease_id, p_success: true })
  })
  it('rechecks the actual website admin role before applying a reply', async () => {
    resultFor = table => ({ data: table === 'profiles' ? { role: 'user' } : null })
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_inbound' ? [incoming] : name === 'feishu_claim_deliveries' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ replies: 0, rejected: 1 })
    expect(mock.rpc.mock.calls.some(([name]) => name === 'feishu_apply_reply')).toBe(false)
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_inbound', expect.objectContaining({ p_success: false, p_permanent: true }))
  })
  it('keeps a missing anchor retryable instead of swallowing an in-flight anchor race', async () => {
    mock.rpc.mockImplementation(async (name: string) => name === 'feishu_apply_reply' ? { data: null, error: { message: 'Feishu reply anchor unavailable' } } : { data: name === 'feishu_claim_inbound' ? [incoming] : name === 'feishu_claim_deliveries' ? [] : true, error: null })
    expect(await runFeishuDispatch()).toMatchObject({ replies: 0, failed: 1, rejected: 0 })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_inbound', expect.objectContaining({ p_success: false, p_permanent: false }))
  })
  it.each([
    { message: 'Feishu reply anchor unavailable', permanent: true, code: 'reply_anchor_unavailable' },
    { message: 'Network request failed', permanent: false, code: 'reply_failed' },
    { message: 'Feishu reply rate limit', permanent: false, code: 'reply_failed' },
  ])('only rejects a fifth confirmed missing anchor, not transient failures: $message', async ({ message, permanent, code }) => {
    mock.rpc.mockImplementation(async (name: string) => name === 'feishu_apply_reply' ? { data: null, error: { message } } : { data: name === 'feishu_claim_inbound' ? [{ ...incoming, attempts: 5 }] : name === 'feishu_claim_deliveries' ? [] : true, error: null })
    expect(await runFeishuDispatch()).toMatchObject({ replies: 0, rejected: permanent ? 1 : 0, failed: permanent ? 0 : 1 })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_inbound', expect.objectContaining({ p_success: false, p_permanent: permanent, p_error: code }))
  })
  it('records a support anchor before acknowledging delivery and uses the real channel label', async () => {
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1, failed: 0 })
    const text = mock.sendText.mock.calls[0][1]
    expect(text).toContain('商城客服'); expect(text).toContain('商品缺件'); expect(text).toContain('有图片，请在后台查看'); expect(text).not.toMatch(/private-phone|private-address/)
    const anchor = mock.rpc.mock.calls.findIndex(([name]) => name === 'feishu_record_anchor')
    const ack = mock.rpc.mock.calls.findIndex(([name, body]) => name === 'feishu_complete_delivery' && body.p_success)
    expect(anchor).toBeGreaterThan(-1); expect(ack).toBeGreaterThan(anchor)
  })
  it('does not mark a send successful when durable anchor recording fails', async () => {
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : name === 'feishu_record_anchor' ? false : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 0, failed: 1 })
    expect(mock.rpc).not.toHaveBeenCalledWith('feishu_complete_delivery', expect.objectContaining({ p_success: true }))
  })
  it('labels platform conversations independently from store support', async () => {
    vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify([{ ...target, channels: ['platform'] }]))
    const previous = resultFor
    resultFor = table => table === 'support_conversations' ? { data: { channel: 'platform' } } : previous(table)
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1 })
    expect(mock.sendText.mock.calls[0][1]).toContain('平台帮助'); expect(mock.sendText.mock.calls[0][1]).not.toContain('商城客服')
  })
  it('rechecks the claimed job against current enabled target bindings before sending', async () => {
    vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify([target, { ...target, id: 'disabled-team', chatId: 'oc_disabled', enabled: false }]))
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_deliveries' ? [{ ...delivery, target_id: 'disabled-team', chat_id: 'oc_disabled' }] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 0, failed: 1 })
    expect(mock.sendText).not.toHaveBeenCalled(); expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_delivery', expect.objectContaining({ p_target: 'disabled-team', p_success: false }))
  })
  it('acknowledges successful targets independently when another target fails', async () => {
    const other = { ...target, id: 'other-team', chatId: 'oc_other' }
    vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify([target, other]))
    mock.sendText.mockImplementation(async (chat: string) => { if (chat === 'oc_other') throw new Error('private-provider-data'); return 'om_delivered' })
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_deliveries' ? [delivery, { ...delivery, target_id: 'other-team', chat_id: 'oc_other' }] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1, failed: 1 })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_delivery', expect.objectContaining({ p_target: 'store-team', p_success: true }))
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_delivery', expect.objectContaining({ p_target: 'other-team', p_success: false, p_error: 'delivery_failed' }))
  })
  it('reads committed final order cents and omits all procurement and address fields', async () => {
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_deliveries' ? [{ ...delivery, kind: 'order.created', support_message_id: null, order_event_id: 12 }] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1 })
    expect(mock.sendText.mock.calls[0][1]).toContain('新订单，待付款'); expect(mock.sendText.mock.calls[0][1]).toContain('¥8.80'); expect(mock.sendText.mock.calls[0][1]).not.toMatch(/private-address|private-cost/)
    expect(mock.rpc.mock.calls.some(([name]) => name === 'feishu_record_anchor')).toBe(false)
  })
})
