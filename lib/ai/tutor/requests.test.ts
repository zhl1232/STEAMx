import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TutorSendSchema } from '@/lib/schemas'
import { beginTutorRequest, completeTutorRequest, failTutorRequest, fallbackTutorUsageToFree } from './requests'
import { createTutorUsageCollector } from './usage'

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
    expect(mocks.rpc.mock.calls[0][0]).toBe('begin_tutor_usage_request_service')
    expect(first.p_max_total_tokens).toBe(131072)
  })

  it('binds scene, epoch, images and tool context into the request fingerprint', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'processing' }, error: null })
    const base = input()
    for (const patch of [{}, { epoch: 4 }, { lessonStepIndex: 2 }, { images: ['https://example.com/photo.png'] }, { content: '换问题' }]) {
      await beginTutorRequest(user, { ...base, ...patch })
    }
    expect(new Set(mocks.rpc.mock.calls.map((call) => call[1].p_request_hash)).size).toBe(5)
  })

  it('retains the exact admitted executor privately for a free fallback', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'started', receiptId: 41, maxTotalTokens: 1000 } })
    const result = await beginTutorRequest(user, input())
    expect(result).toMatchObject({ status: 'started', executorId: mocks.rpc.mock.calls[0][1].p_executor_id })
  })

  it('recovers an uncertain free fallback using the same request, receipt and executor', async () => {
    const executorId = '44444444-4444-4444-8444-444444444444'
    mocks.rpc.mockRejectedValueOnce(new Error('lost after funding switch'))
      .mockResolvedValueOnce({ data: { ok: true, source: 'free', receiptId: 41, maxTotalTokens: 131072 } })
    await expect(fallbackTutorUsageToFree(user, requestId, { receiptId: 41, executorId, minimumTotalTokens: 4000 }))
      .resolves.toEqual({ maxTotalTokens: 131072 })
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1])
    expect(mocks.rpc.mock.calls[0]).toEqual(['fallback_tutor_usage_to_free_service', {
      p_user_id: user, p_request_id: requestId, p_receipt_id: 41, p_executor_id: executorId, p_min_total_tokens: 4000,
    }])
  })

  it('does not expand the budget after free quota rejection or a mismatched receipt', async () => {
    const args = { receiptId: 41, executorId: 'executor', minimumTotalTokens: 4000 }
    mocks.rpc.mockResolvedValueOnce({ data: { ok: false, error: 'quota_exceeded' } })
    await expect(fallbackTutorUsageToFree(user, requestId, args)).resolves.toBeNull()
    mocks.rpc.mockResolvedValueOnce({ data: { ok: true, source: 'free', receiptId: 99, maxTotalTokens: 131072 } })
    await expect(fallbackTutorUsageToFree(user, requestId, args)).rejects.toThrow('Invalid tutor free fallback reservation')
  })

  it('retries an uncertain completion with identical arguments and never issues a refund', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('connection lost after commit'))
      .mockResolvedValueOnce({ data: { status: 'completed', message: { content: '原回复' } } })
    const usage = createTutorUsageCollector({ maxTotalTokens: 131072 }).snapshot()
    const result = await completeTutorRequest(user, requestId, { content: '问题', images: [], meta: {}, reply: '原回复', assistantMeta: {}, usage, title: '课时' })
    expect(result.status).toBe('completed')
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1])
    expect(mocks.rpc.mock.calls.every(([name]) => name === 'complete_tutor_usage_request_service')).toBe(true)
    expect(mocks.rpc.mock.calls[0][1].p_usage).toEqual(usage)
  })

  it('does not claim failure when release could not be confirmed', async () => {
    mocks.rpc.mockRejectedValue(new Error('database unreachable'))
    await expect(failTutorRequest(user, requestId)).rejects.toThrow('database unreachable')
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1])
  })
})
