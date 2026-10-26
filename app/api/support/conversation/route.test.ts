import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), own: vi.fn(), send: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/support/server', () => ({
  supportSession: mocks.session,
  ownConversation: mocks.own,
  sendSupportMessage: mocks.send,
}))
vi.mock('@/lib/support/notifications', () => ({ supportNotificationHealth: () => ({ configured: false }) }))
import { GET, POST } from './route'
import { GET as unread } from '../unread/route'
import { GET as inbox } from '../../admin/support/conversations/route'
import { POST as feedback } from '../../settings/feedback/route'
function query(result: unknown) {
  const methods = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), is: vi.fn() }
  const q = { ...methods, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }
  for (const method of Object.values(methods)) method.mockReturnValue(q)
  return q
}
const ctx = { user: { id: 'user' }, db: { from: mocks.from, rpc: mocks.rpc } }
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue(ctx) })
describe('support channel HTTP boundaries', () => {
  it('defaults old conversation links to platform and passes an explicit store channel', async () => {
    mocks.own.mockImplementation(async (_ctx, channel) => ({ id: channel, channel }))
    const old = await POST(new NextRequest('https://example.test/api/support/conversation', { method: 'POST' }))
    const store = await POST(new NextRequest('https://example.test/api/support/conversation?channel=store', { method: 'POST' }))
    expect((await old.json()).conversation.channel).toBe('platform')
    expect((await store.json()).conversation.channel).toBe('store')
  })
  it.each(['unknown', '', 'store&channel=platform'])('rejects an invalid or repeated channel: %s', async channel => {
    const response = await POST(new NextRequest(`https://example.test/api/support/conversation?channel=${channel}`, { method: 'POST' }))
    expect(response.status).toBe(400)
    expect(mocks.own).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it('reads only the signed-in user and selected channel without creating a conversation', async () => {
    const scoped = query({ data: null, error: null }); mocks.from.mockReturnValue(scoped)
    const response = await GET(new NextRequest('https://example.test/api/support/conversation?channel=store'))
    expect((await response.json()).conversation).toBeNull()
    expect(scoped.eq).toHaveBeenCalledWith('user_id', 'user')
    expect(scoped.eq).toHaveBeenCalledWith('channel', 'store')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.own).not.toHaveBeenCalled()
  })
  it('returns independent unread counts and their total', async () => {
    mocks.rpc.mockResolvedValue({ data: { platform: 2, store: 3 }, error: null })
    const response = await unread()
    expect(await response.json()).toEqual({ unreadCount: 5, unreadByChannel: { platform: 2, store: 3 } })
    expect(mocks.rpc).toHaveBeenCalledWith('support_user_unread', { p_user: 'user' })
  })
  it('filters the admin inbox and pending notification count to the same channel', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: 'store', channel: 'store' }], error: null })
    const pending = query({ count: 4, error: null }); mocks.from.mockReturnValue(pending)
    const response = await inbox(new NextRequest('https://example.test/api/admin/support/conversations?channel=store&offset=50'))
    expect(mocks.session).toHaveBeenCalledWith(true)
    expect(mocks.rpc).toHaveBeenCalledWith('support_inbox_channel', { p_channel: 'store', p_offset: 50 })
    expect(pending.eq).toHaveBeenCalledWith('support_conversations.channel', 'store')
    expect((await response.json()).notificationHealth.pending).toBe(4)
  })
  it('keeps website feedback in platform support even if a request attempts to select store', async () => {
    mocks.own.mockResolvedValue({ id: 'platform', channel: 'platform' }); mocks.send.mockResolvedValue({})
    const response = await feedback(new NextRequest('https://example.test/api/settings/feedback?channel=store', { method: 'POST', body: JSON.stringify({ content: '页面有问题', clientId: 'request', channel: 'store' }) }))
    expect(mocks.own).toHaveBeenCalledWith(ctx, 'platform')
    expect(await response.json()).toMatchObject({ recipientName: '平台帮助', href: '/support' })
  })
})
