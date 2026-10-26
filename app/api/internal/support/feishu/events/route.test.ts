import { NextRequest } from 'next/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ enqueue: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/support/feishu/service', () => ({ enqueueFeishuEvent: mocks.enqueue, readDiscovery: mocks.read }))
import { FeishuBridgeError } from '@/lib/support/feishu/config'
import { GET, POST } from './route'
function request(body: string, authorized = true) {
  return new NextRequest('http://localhost/api/internal/support/feishu/events', { method: 'POST', headers: authorized ? { authorization: 'Bearer test-internal' } : {}, body })
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-internal'); mocks.enqueue.mockResolvedValue({ queued: true }); mocks.read.mockResolvedValue([]) })
afterEach(() => vi.unstubAllEnvs())
it('authenticates before reading events or discovery candidates', async () => {
  expect((await POST(request('{}', false))).status).toBe(401)
  expect((await GET(new NextRequest('http://localhost/api/internal/support/feishu/events'))).status).toBe(401)
  expect(mocks.enqueue).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled()
})
it('rejects oversized streamed bodies even without a content-length header', async () => {
  expect((await POST(request('x'.repeat(32769)))).status).toBe(413)
  expect(mocks.enqueue).not.toHaveBeenCalled()
})
it('rejects invalid JSON and hands valid bodies to the durable event boundary', async () => {
  expect((await POST(request('{'))).status).toBe(400)
  const response = await POST(request('{"event_id":"event"}'))
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ queued: true })
  expect(mocks.enqueue).toHaveBeenCalledWith({ event_id: 'event' })
})
it('does not acknowledge events while the bridge is disabled', async () => {
  mocks.enqueue.mockRejectedValue(new FeishuBridgeError('bridge_disabled'))
  const response = await POST(request('{}'))
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'bridge_disabled' })
})
it('returns only candidate records from the authenticated discovery boundary', async () => {
  const response = await GET(new NextRequest('http://localhost/api/internal/support/feishu/events', { headers: { authorization: 'Bearer test-internal' } }))
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ candidates: [] }); expect(response.headers.get('Cache-Control')).toBe('no-store')
})
