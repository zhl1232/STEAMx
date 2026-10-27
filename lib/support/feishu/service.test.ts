import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), sendText: vi.fn(), sendPost: vi.fn(), uploadImage: vi.fn(), downloadImage: vi.fn(), storageDownload: vi.fn(), storageUpload: vi.fn(), botOpenId: vi.fn(), validate: vi.fn(), moderate: vi.fn(), file: '', mode: 0,
}))
vi.mock('../server', () => ({ supportDb: () => ({ rpc: (...args: unknown[]) => Object.assign(mock.rpc(...args), { abortSignal() { return this } }), from: mock.from, storage: { from: () => ({ download: mock.storageDownload, upload: mock.storageUpload }) } }) }))
vi.mock('./media', () => ({ feishuStorage: () => ({ download: mock.storageDownload, upload: mock.storageUpload }) }))
vi.mock('./client', () => ({ getFeishuClient: () => ({ sendText: mock.sendText, sendPost: mock.sendPost, uploadImage: mock.uploadImage, downloadImage: mock.downloadImage, botOpenId: mock.botOpenId }) }))
vi.mock('@/lib/api/validation', () => ({ validateContentSafe: mock.validate }))
vi.mock('@/lib/safety/server', () => ({ moderateTextContent: mock.moderate }))
vi.mock('node:fs/promises', () => ({ open: vi.fn(async () => ({
  stat: async () => ({ size: Buffer.byteLength(mock.file) }), chmod: async (mode: number) => { mock.mode = mode },
  read: async (buffer: Buffer) => ({ bytesRead: Buffer.from(mock.file).copy(buffer) }),
  write: async (text: string, position: number) => { mock.file = mock.file.slice(0, position) + text }, sync: async () => {}, close: async () => {},
})) }))
import { enqueueFeishuEvent, readDiscovery, runFeishuDispatch } from './service'

const conversationId = '20000000-0000-4000-8000-000000000001'
const attachmentId = '30000000-0000-4000-8000-000000000001'
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(16).fill(0)])
const attachment = { id: attachmentId, conversation_id: conversationId, uploader_id: '10000000-0000-4000-8000-000000000001', storage_path: `${conversationId}/${attachmentId}`, mime_type: 'image/png', size_bytes: png.length }
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
  const q = { select: vi.fn(), eq: vi.fn(), limit: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn(async () => resultFor(table)), then: (resolve: (value: Result) => unknown) => Promise.resolve(resultFor(table)).then(resolve) }
  q.select.mockReturnValue(q); q.eq.mockReturnValue(q); q.limit.mockReturnValue(q); q.abortSignal.mockReturnValue(q)
  return q
}
beforeEach(() => {
  vi.clearAllMocks(); mock.file = ''; mock.mode = 0
  vi.stubEnv('FEISHU_BRIDGE_ENABLED', 'true'); vi.stubEnv('FEISHU_APP_ID', appId); vi.stubEnv('FEISHU_APP_SECRET', 'private-secret'); vi.stubEnv('FEISHU_TENANT_KEY', ''); vi.stubEnv('FEISHU_SITE_URL', 'https://example.test')
  vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify([target])); vi.stubEnv('FEISHU_STAFF_JSON', JSON.stringify([{ openId: 'ou_staff', profileId }]))
  mock.sendPost.mockResolvedValue('om_delivered'); mock.uploadImage.mockResolvedValue('img_uploaded'); mock.downloadImage.mockResolvedValue(png); mock.storageDownload.mockResolvedValue({ data: new Blob([png]), error: null }); mock.storageUpload.mockResolvedValue({ data: {}, error: null }); mock.botOpenId.mockResolvedValue('ou_bot'); mock.sendText.mockResolvedValue('om_delivered'); mock.moderate.mockReturnValue({ state: 'approved' })
  mock.rpc.mockImplementation(async (name: string) => ({ data: name.startsWith('feishu_claim_') ? [] : true, error: null }))
  resultFor = table => ({ data: table === 'profiles' ? { role: 'admin' } : table === 'support_messages' ? { content: '商品缺件', sender_role: 'user', conversation_id: conversationId, phone: 'private-phone', address: 'private-address' } : table === 'support_conversations' ? { channel: 'store' } : table === 'store_order_events' ? { order_id: 'order-one' } : table === 'store_orders' ? { id: 'order-one', total_cents: 880, status: 'pending_payment', address_snapshot_encrypted: 'private-address', procurement_cost: 'private-cost' } : table === 'support_attachments' ? [] : null, error: null })
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
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_inbound' ? [incoming] : name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [] : name === 'feishu_apply_reply' ? { message_id: 'site-reply' } : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ replies: 1, failed: 0 })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_apply_reply', expect.objectContaining({ p_actor: profileId, p_content: incoming.text }))
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_inbound', { p_message_id: incoming.message_id, p_lease: incoming.lease_id, p_success: true })
  })
  it('rechecks the actual website admin role before applying a reply', async () => {
    resultFor = table => ({ data: table === 'profiles' ? { role: 'user' } : null })
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_claim_inbound' ? [incoming] : name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ replies: 0, rejected: 1 })
    expect(mock.rpc.mock.calls.some(([name]) => name === 'feishu_apply_reply')).toBe(false)
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_inbound', expect.objectContaining({ p_success: false, p_permanent: true }))
  })
  it('keeps a missing anchor retryable instead of swallowing an in-flight anchor race', async () => {
    mock.rpc.mockImplementation(async (name: string) => name === 'feishu_apply_reply' ? { data: null, error: { message: 'Feishu reply anchor unavailable' } } : { data: name === 'feishu_claim_inbound' ? [incoming] : name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [] : true, error: null })
    expect(await runFeishuDispatch()).toMatchObject({ replies: 0, failed: 1, rejected: 0 })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_inbound', expect.objectContaining({ p_success: false, p_permanent: false }))
  })
  it.each([
    { message: 'Feishu reply anchor unavailable', permanent: true, code: 'reply_anchor_unavailable' },
    { message: 'Network request failed', permanent: false, code: 'reply_failed' },
    { message: 'Feishu reply rate limit', permanent: false, code: 'reply_failed' },
  ])('only rejects a fifth confirmed missing anchor, not transient failures: $message', async ({ message, permanent, code }) => {
    mock.rpc.mockImplementation(async (name: string) => name === 'feishu_apply_reply' ? { data: null, error: { message } } : { data: name === 'feishu_claim_inbound' ? [{ ...incoming, attempts: 5 }] : name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [] : true, error: null })
    expect(await runFeishuDispatch()).toMatchObject({ replies: 0, rejected: permanent ? 1 : 0, failed: permanent ? 0 : 1 })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_inbound', expect.objectContaining({ p_success: false, p_permanent: permanent, p_error: code }))
  })
  it('atomically records a support anchor and acknowledges delivery with the real channel label', async () => {
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1, failed: 0 })
    const text = mock.sendText.mock.calls[0][1]
    expect(text).toContain('商城客服'); expect(text).toContain('商品缺件'); expect(text).not.toMatch(/private-phone|private-address/)
    expect(mock.rpc).toHaveBeenCalledWith('feishu_finish_thread_delivery', expect.objectContaining({ p_message_id: 'om_delivered' }))
  })
  it('does not mark a send successful when durable anchor recording fails', async () => {
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : name === 'feishu_finish_thread_delivery' ? false : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 0, failed: 1 })
    expect(mock.rpc).not.toHaveBeenCalledWith('feishu_complete_delivery', expect.objectContaining({ p_success: true }))
  })
  it('retries an unconfirmed root through the same create request identity', async () => {
    let confirmations = 0
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : name === 'feishu_finish_thread_delivery' ? ++confirmations > 1 : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 0, failed: 1 })
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1, failed: 0 })
    expect(mock.sendText).toHaveBeenCalledTimes(2)
    for (const args of mock.sendText.mock.calls) {
      expect(args.slice(2, 4)).toEqual([delivery.event_id, delivery.target_id])
      expect(args.at(-1)).toBeUndefined()
    }
  })
  it.each([false, true])('routes text and rich messages to the persisted thread root: images=%s', async images => {
    const previous = resultFor
    if (images) resultFor = table => table === 'support_attachments' ? { data: [{ id: '22222222-2222-4222-8222-222222222222', conversation_id: conversationId, storage_path: `${conversationId}/22222222-2222-4222-8222-222222222222`, mime_type: 'image/png', size_bytes: png.length }] } : previous(table)
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: 'om_thread_root' } : name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1, failed: 0 })
    const args = (images ? mock.sendPost : mock.sendText).mock.calls[0]
    expect(args.at(-1)).toBe('om_thread_root')
  })
  it('keeps a root lookup failure queued without sending a standalone message', async () => {
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? null : name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 0, failed: 1 })
    expect(mock.sendText).not.toHaveBeenCalled()
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_delivery', expect.objectContaining({ p_success: false }))
  })
  it('keeps a failed thread reply queued without falling back to standalone send', async () => {
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: 'om_missing_root' } : name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    mock.sendText.mockRejectedValueOnce(new Error('root deleted'))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 0, failed: 1 })
    expect(mock.sendText).toHaveBeenCalledTimes(1)
    expect(mock.sendText.mock.calls[0].at(-1)).toBe('om_missing_root')
  })
  it('labels platform conversations independently from store support', async () => {
    vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify([{ ...target, channels: ['platform'] }]))
    const previous = resultFor
    resultFor = table => table === 'support_conversations' ? { data: { channel: 'platform' } } : previous(table)
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1 })
    expect(mock.sendText.mock.calls[0][1]).toContain('平台帮助'); expect(mock.sendText.mock.calls[0][1]).not.toContain('商城客服')
  })
  it('rechecks the claimed job against current enabled target bindings before sending', async () => {
    vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify([target, { ...target, id: 'disabled-team', chatId: 'oc_disabled', enabled: false }]))
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [{ ...delivery, target_id: 'disabled-team', chat_id: 'oc_disabled' }] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 0, failed: 1 })
    expect(mock.sendText).not.toHaveBeenCalled(); expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_delivery', expect.objectContaining({ p_target: 'disabled-team', p_success: false }))
  })
  it('acknowledges successful targets independently when another target fails', async () => {
    const other = { ...target, id: 'other-team', chatId: 'oc_other' }
    vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify([target, other]))
    mock.sendText.mockImplementation(async (chat: string) => { if (chat === 'oc_other') throw new Error('private-provider-data'); return 'om_delivered' })
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [delivery, { ...delivery, target_id: 'other-team', chat_id: 'oc_other' }] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1, failed: 1 })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_finish_thread_delivery', expect.objectContaining({ p_target: 'store-team', p_message_id: 'om_delivered' }))
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_delivery', expect.objectContaining({ p_target: 'other-team', p_success: false, p_error: 'delivery_failed' }))
  })
  it('reads committed final order cents and omits all procurement and address fields', async () => {
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [{ ...delivery, kind: 'order.created', support_message_id: null, order_event_id: 12 }] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1 })
    expect(mock.sendText.mock.calls[0][1]).toContain('新订单，待付款'); expect(mock.sendText.mock.calls[0][1]).toContain('¥8.80'); expect(mock.sendText.mock.calls[0][1]).not.toMatch(/private-address|private-cost/)
    expect(mock.rpc).toHaveBeenCalledWith('feishu_finish_thread_delivery', expect.objectContaining({ p_message_id: 'om_delivered' }))
  })
})

describe('Feishu private image bridge', () => {
  function incomingMedia(keys = ['img_source']) { return { ...incoming, text: '', image_keys: keys } }
  function mediaRpc(options: { duplicate?: boolean; prepareError?: string; applyError?: string } = {}) {
    mock.rpc.mockImplementation(async (name: string) => ({
      data: name === 'feishu_claim_inbound' ? [incomingMedia()] : name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [] : name === 'feishu_prepare_reply' ? { conversation_id: conversationId, duplicate: Boolean(options.duplicate), ...(options.duplicate ? { message_id: 'site-reply' } : {}) } : name === 'feishu_prepare_image_attachment' ? attachment : name === 'feishu_apply_reply_media' ? { message_id: 'site-reply' } : true,
      error: (name === 'feishu_prepare_reply' && options.prepareError) || (name === 'feishu_apply_reply_media' && options.applyError) ? { message: options.prepareError || options.applyError } : null,
    }))
  }
  it('queues authorized image-only replies and mentioned rich posts with image keys', async () => {
    const image = event(); image.message.message_type = 'image'; image.message.mentions = []; image.message.content = JSON.stringify({ image_key: 'img_source' })
    expect(await enqueueFeishuEvent(image)).toEqual({ queued: true, duplicate: false })
    expect(mock.rpc).toHaveBeenLastCalledWith('feishu_enqueue_inbound_media', expect.objectContaining({ p_text: '', p_image_keys: ['img_source'] }))
    const post = event(); post.message.message_type = 'post'; post.message.content = JSON.stringify({ content: [[{ tag: 'at', user_id: '@_bot' }, { tag: 'text', text: '请查看' }, { tag: 'img', image_key: 'img_source' }]] })
    expect(await enqueueFeishuEvent(post)).toEqual({ queued: true, duplicate: false })
    expect(mock.rpc).toHaveBeenLastCalledWith('feishu_enqueue_inbound_media', expect.objectContaining({ p_text: '请查看', p_image_keys: ['img_source'] }))
    expect(mock.downloadImage).not.toHaveBeenCalled()
  })
  it('does not queue unbound, cross-group, unanchored images or posts without the bot mention', async () => {
    for (const mutate of [(data: ReturnType<typeof event>) => { data.sender.sender_id.open_id = 'ou_other' }, (data: ReturnType<typeof event>) => { data.message.chat_id = 'oc_other' }, (data: ReturnType<typeof event>) => { data.message.parent_id = '' }]) {
      const data = event(); data.message.message_type = 'image'; data.message.content = '{"image_key":"img_source"}'; mutate(data)
      expect(await enqueueFeishuEvent(data)).toEqual({ ignored: true })
    }
    const post = event(); post.message.message_type = 'post'; post.message.content = '{"content":[[{"tag":"img","image_key":"img_source"}]]}'
    expect(await enqueueFeishuEvent(post)).toEqual({ ignored: true })
    expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.downloadImage).not.toHaveBeenCalled()
  })
  it('authorizes the database anchor before downloading, reserves stable metadata and commits ordered attachments', async () => {
    mediaRpc()
    expect(await runFeishuDispatch()).toMatchObject({ replies: 1, failed: 0 })
    expect(mock.rpc).toHaveBeenCalledWith('feishu_prepare_reply', expect.objectContaining({ p_actor: profileId, p_chat_id: incoming.chat_id }))
    expect(mock.rpc.mock.invocationCallOrder[mock.rpc.mock.calls.findIndex(([name]) => name === 'feishu_prepare_reply')]).toBeLessThan(mock.downloadImage.mock.invocationCallOrder[0])
    expect(mock.downloadImage).toHaveBeenCalledWith(incoming.message_id, 'img_source', expect.any(AbortSignal))
    expect(mock.storageUpload).toHaveBeenCalledWith(attachment.storage_path, png, expect.objectContaining({ contentType: 'image/png', upsert: false }))
    expect(mock.rpc).toHaveBeenCalledWith('feishu_apply_reply_media', expect.objectContaining({ p_attachments: [attachmentId], p_content: '' }))
    const applyIndex = mock.rpc.mock.calls.findIndex(([name]) => name === 'feishu_apply_reply_media')
    const ackIndex = mock.rpc.mock.calls.findIndex(([name, body]) => name === 'feishu_complete_inbound' && body.p_success)
    expect(ackIndex).toBeGreaterThan(applyIndex)
  })
  it.each(['Feishu reply target unavailable', 'Ambiguous Feishu reply anchor', 'Feishu queued reply identity mismatch'])('rejects unauthorized database preflight before media access: %s', async prepareError => {
    mediaRpc({ prepareError })
    expect(await runFeishuDispatch()).toMatchObject({ rejected: 1, replies: 0 })
    expect(mock.downloadImage).not.toHaveBeenCalled(); expect(mock.storageUpload).not.toHaveBeenCalled()
  })
  it('acknowledges an already committed reply without downloading or uploading again', async () => {
    mediaRpc({ duplicate: true })
    expect(await runFeishuDispatch()).toMatchObject({ replies: 1 })
    expect(mock.downloadImage).not.toHaveBeenCalled(); expect(mock.storageUpload).not.toHaveBeenCalled()
    expect(mock.rpc.mock.calls.some(([name]) => name === 'feishu_apply_reply_media')).toBe(false)
  })
  it('reuses the validated reserved path after a partial upload and retries database failures without overwriting', async () => {
    mediaRpc({ applyError: 'Network request failed' })
    expect(await runFeishuDispatch()).toMatchObject({ replies: 0, failed: 1 })
    mediaRpc()
    mock.storageUpload.mockResolvedValue({ data: null, error: { statusCode: '409', message: 'already exists' } })
    expect(await runFeishuDispatch()).toMatchObject({ replies: 1 })
    expect(mock.storageUpload.mock.calls.map(call => call[0])).toEqual([attachment.storage_path, attachment.storage_path])
    expect(mock.storageUpload.mock.calls.every(call => call[2].upsert === false)).toBe(true)
  })
  it('keeps storage permission failures retryable and never commits or acknowledges success', async () => {
    mediaRpc(); mock.storageUpload.mockResolvedValue({ data: null, error: { statusCode: '403', message: 'private-data' } })
    expect(await runFeishuDispatch()).toMatchObject({ failed: 1, rejected: 0 })
    expect(mock.rpc.mock.calls.some(([name]) => name === 'feishu_apply_reply_media')).toBe(false)
    expect(mock.rpc).toHaveBeenCalledWith('feishu_complete_inbound', expect.objectContaining({ p_success: false, p_permanent: false }))
  })
  it('rejects invalid downloaded bytes or mismatched reservation metadata permanently', async () => {
    mediaRpc(); mock.downloadImage.mockResolvedValueOnce(new TextEncoder().encode('<svg/>'))
    expect(await runFeishuDispatch()).toMatchObject({ rejected: 1, replies: 0 })
    expect(mock.storageUpload).not.toHaveBeenCalled()
    mediaRpc()
    const implementation = mock.rpc.getMockImplementation()!
    mock.rpc.mockImplementation(async (name: string, ...args: unknown[]) => name === 'feishu_prepare_image_attachment' ? { data: { ...attachment, storage_path: '../private' }, error: null } : implementation(name, ...args))
    expect(await runFeishuDispatch()).toMatchObject({ rejected: 1, replies: 0 })
    expect(mock.storageUpload).not.toHaveBeenCalled()
  })
  it('sends private attachment bytes as one rich post and never emits private URLs or storage paths', async () => {
    const previous = resultFor
    resultFor = table => table === 'support_attachments' ? { data: [attachment] } : previous(table)
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 1, failed: 0 })
    expect(mock.storageDownload).toHaveBeenCalledWith(attachment.storage_path, {}, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(mock.uploadImage).toHaveBeenCalledWith(png, expect.any(AbortSignal))
    expect(mock.sendPost).toHaveBeenCalledTimes(1); expect(mock.sendText).not.toHaveBeenCalled()
    expect(mock.sendPost.mock.calls[0][2]).toEqual(['img_uploaded'])
    expect(mock.sendPost.mock.calls[0][1]).not.toMatch(/support-private|storage\/v1|private-address|private-phone/)
    expect(mock.sendPost.mock.calls[0][1]).not.toContain(attachment.storage_path)
    expect(mock.rpc).toHaveBeenCalledWith('feishu_finish_thread_delivery', expect.objectContaining({ p_message_id: 'om_delivered' }))
  })
  it.each(['ownership', 'too_many', 'size'])('rejects invalid outbound attachment %s before reading private storage', async reason => {
    const previous = resultFor
    const invalid = reason === 'ownership' ? { ...attachment, conversation_id: 'other' } : { ...attachment, size_bytes: 6 * 1024 * 1024 }
    resultFor = table => table === 'support_attachments' ? { data: reason === 'too_many' ? [attachment, attachment, attachment, attachment] : [invalid] } : previous(table)
    mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [delivery] : name === 'feishu_claim_inbound' ? [] : true, error: null }))
    expect(await runFeishuDispatch()).toMatchObject({ sent: 0, failed: 1 })
    expect(mock.storageDownload).not.toHaveBeenCalled(); expect(mock.uploadImage).not.toHaveBeenCalled(); expect(mock.sendPost).not.toHaveBeenCalled()
  })
})

it('preserves queued image order when reserving multiple attachments', async () => {
  const keys = ['img_one', 'img_two', 'img_three']
  const ids = [attachmentId, '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003']
  mock.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => ({
    data: name === 'feishu_claim_inbound' ? [{ ...incoming, image_keys: keys }] : name === 'feishu_prepare_thread' ? { root_message_id: null } : name === 'feishu_claim_deliveries' ? [] : name === 'feishu_prepare_reply' ? { conversation_id: conversationId, duplicate: false } : name === 'feishu_prepare_image_attachment' ? { ...attachment, id: ids[keys.indexOf(String(args.p_image_key))], storage_path: `${conversationId}/${ids[keys.indexOf(String(args.p_image_key))]}` } : name === 'feishu_apply_reply_media' ? { message_id: 'site-reply' } : true,
    error: null,
  }))
  expect(await runFeishuDispatch()).toMatchObject({ replies: 1, failed: 0 })
  expect(mock.rpc).toHaveBeenCalledWith('feishu_apply_reply_media', expect.objectContaining({ p_attachments: ids }))
  expect(mock.rpc).toHaveBeenCalledWith('feishu_claim_inbound', { p_limit: 2 })
  expect(mock.rpc).toHaveBeenCalledWith('feishu_claim_deliveries', { p_limit: 2 })
})
it('does not claim outgoing deliveries after the operation budget expires', async () => {
  const controller = new AbortController()
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  const spy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => ms === 45000 ? controller.signal : timeout(ms))
  mock.rpc.mockImplementation(async (name: string) => {
    if (name === 'feishu_claim_inbound') { controller.abort(); return { data: [], error: null } }
    return { data: true, error: null }
  })
  try {
    expect(await runFeishuDispatch()).toMatchObject({ sent: 0, replies: 0 })
    expect(mock.rpc.mock.calls.some(([name]) => name === 'feishu_claim_deliveries')).toBe(false)
  } finally { spy.mockRestore() }
})
