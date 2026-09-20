import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TutorSendSchema } from '@/lib/schemas'
import { beginTutorRequest, completeTutorRequest, failTutorRequest } from './requests'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { rpc: mocks.rpc } }))
const user = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const input = () => TutorSendSchema.parse({ requestId, epoch: 3, content: '帮我看看', lessonId: 7 })

describe('durable tutor request RPCs', () => {
  beforeEach(() => { mocks.rpc.mockReset() })

  it('recovers a lost admission response with the same executor but gives another HTTP invocation a new executor', async () => {
    mocks.rpc.mockResolvedValueOnce({ error: new Error('response lost') })
      .mockResolvedValue({ data: { status: 'processing' }, error: null })
    await beginTutorRequest(user, input())
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1])
    await beginTutorRequest(user, input())
    const first = mocks.rpc.mock.calls[0][1], next = mocks.rpc.mock.calls[2][1]
    expect(next.p_executor_id).not.toBe(first.p_executor_id)
    expect(next.p_request_hash).toBe(first.p_request_hash)
    expect(next.p_request_id).toBe(requestId)
  })

  it('binds scene, epoch, images and tool context into the request fingerprint', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'processing' }, error: null })
    const base = input()
    for (const patch of [{}, { epoch: 4 }, { lessonStepIndex: 2 }, { images: ['https://example.com/photo.png'] }, { content: '换问题' }]) {
      await beginTutorRequest(user, { ...base, ...patch })
    }
    expect(new Set(mocks.rpc.mock.calls.map((call) => call[1].p_request_hash)).size).toBe(5)
  })

  it('retries an uncertain completion with identical arguments and never issues a refund', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('connection lost after commit'))
      .mockResolvedValueOnce({ data: { status: 'completed', message: { content: '原回复' } } })
    const result = await completeTutorRequest(user, requestId, { content: '问题', images: [], meta: {}, reply: '原回复', assistantMeta: {}, outputTokens: 100, title: '课时' })
    expect(result.status).toBe('completed')
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1])
    expect(mocks.rpc.mock.calls.every(([name]) => name === 'complete_tutor_request_service')).toBe(true)
  })

  it('does not claim failure when release could not be confirmed', async () => {
    mocks.rpc.mockRejectedValue(new Error('database unreachable'))
    await expect(failTutorRequest(user, requestId)).rejects.toThrow('database unreachable')
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1])
  })
})
