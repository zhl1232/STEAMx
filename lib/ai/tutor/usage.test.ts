import { describe, expect, it, vi } from 'vitest'

import { parseDashScopeUsage } from '@/lib/ai/dashscope'
import {
  createTutorUsageCollector,
  estimateTutorInputTokens,
  normalizeTutorUsage,
  TUTOR_IMAGE_INPUT_RESERVE_TOKENS,
  TutorUsageBudgetError,
} from '@/lib/ai/tutor/usage'

const payload = { messages: [{ role: 'user', content: '请继续。' }], max_tokens: 100 }
const attempt = { role: 'tutor-planner' as const, model: 'test-model', payload }

describe('verified tutor request usage', () => {
  it('counts input and all output once, including reasoning already inside completion', () => {
    expect(normalizeTutorUsage({ promptTokens: 80, completionTokens: 20, totalTokens: 100, reasoningTokens: 12 }))
      .toEqual({ inputTokens: 80, outputTokens: 20, totalTokens: 100 })
    expect(normalizeTutorUsage({ promptTokens: 80, completionTokens: 20 }))
      .toEqual({ inputTokens: 80, outputTokens: 20, totalTokens: 100 })
    expect(normalizeTutorUsage({ totalTokens: 100 }))
      .toEqual({ inputTokens: null, outputTokens: null, totalTokens: 100 })
    expect(normalizeTutorUsage({ totalTokens: 100, completionTokens: 20 }))
      .toEqual({ inputTokens: 80, outputTokens: 20, totalTokens: 100 })
  })

  it.each([
    null,
    { completionTokens: 20 },
    { promptTokens: 80 },
    { promptTokens: 80, completionTokens: 20, totalTokens: 90 },
    { promptTokens: 101, totalTokens: 100 },
    { promptTokens: 80, completionTokens: 20, reasoningTokens: 21 },
    { promptTokens: 80, totalTokens: 100, reasoningTokens: 21 },
    { totalTokens: -1 },
    { totalTokens: 1.5 },
    { totalTokens: Number.POSITIVE_INFINITY },
    { totalTokens: Number.MAX_SAFE_INTEGER + 1 },
  ])('does not estimate missing or inconsistent usage: %j', (usage) => {
    expect(normalizeTutorUsage(usage)).toBeNull()
  })

  it('does not hide malformed component counts behind an apparently valid total', () => {
    expect(parseDashScopeUsage({ prompt_tokens: -1, completion_tokens: 20, total_tokens: 100 })).toBeNull()
    expect(parseDashScopeUsage({ prompt_tokens: '80', total_tokens: 100 })).toBeNull()
  })

  it('isolates simultaneous requests, records unused calls and finalizes each attempt once', () => {
    const first = createTutorUsageCollector({ maxTotalTokens: 10_000 })
    const second = createTutorUsageCollector({ maxTotalTokens: 10_000 })
    const planner = first.forPurpose('resource_planner').start(attempt)
    const otherUser = second.forPurpose('main_reply').start(attempt)
    const discardedAudio = first.forPurpose('audio_planner').start(attempt)
    discardedAudio.finish({ usage: { promptTokens: 40, completionTokens: 10, totalTokens: 50 }, status: 'completed' })
    otherUser.finish({ usage: { totalTokens: 900 }, status: 'completed' })
    planner.finish({ usage: { promptTokens: 200, completionTokens: 30, totalTokens: 230 }, status: 'completed' })
    planner.finish({ usage: { totalTokens: 5000 }, status: 'completed' })

    expect(first.snapshot()).toMatchObject({ inputTokens: 240, outputTokens: 40, totalTokens: 280, pendingCalls: 0, usageMissing: false })
    expect(first.snapshot().calls.map((call) => call.purpose)).toEqual(['resource_planner', 'audio_planner'])
    expect(second.snapshot()).toMatchObject({ totalTokens: 900, inputTokens: null, outputTokens: null })
    const copied = first.snapshot()
    copied.calls[0].usage!.totalTokens = 9999
    expect(first.snapshot().calls[0].usage!.totalTokens).toBe(230)
  })

  it('retains verified calls when another call has missing or invalid usage', () => {
    const collector = createTutorUsageCollector({ maxTotalTokens: 10_000 })
    collector.forPurpose('main_reply').start(attempt).finish({ usage: { promptTokens: 100, completionTokens: 30 }, status: 'completed' })
    collector.forPurpose('resource_planner').start(attempt).finish({ usage: null, status: 'completed' })
    collector.forPurpose('tool_planner').start(attempt).finish({ usage: { totalTokens: -10 }, status: 'failed' })
    expect(collector.snapshot()).toMatchObject({ totalTokens: 130, inputTokens: 100, outputTokens: 30, usageMissing: true, pendingCalls: 0 })
    expect(collector.snapshot().calls[2].usage).toBeNull()
  })
})

describe('request execution budget', () => {
  it('reserves concurrent in-flight work before provider results arrive', () => {
    const reservation = estimateTutorInputTokens(payload) + 100
    const collector = createTutorUsageCollector({ maxTotalTokens: reservation })
    const first = collector.forPurpose('resource_planner').start(attempt)
    expect(() => collector.forPurpose('tool_planner').start(attempt)).toThrow(TutorUsageBudgetError)
    expect(collector.snapshot()).toMatchObject({ pendingCalls: 1, budgetDeniedCalls: 1, totalTokens: 0 })
    first.finish({ usage: { totalTokens: 0 }, status: 'completed' })
    expect(() => collector.forPurpose('tool_planner').start(attempt)).not.toThrow()
  })

  it('does not free execution budget after missing usage, but never charges its estimate', () => {
    const collector = createTutorUsageCollector({ maxTotalTokens: estimateTutorInputTokens(payload) + 100 })
    collector.forPurpose('resource_planner').start(attempt).finish({ usage: null, status: 'completed' })
    expect(() => collector.forPurpose('resource_planner').start(attempt)).toThrow(TutorUsageBudgetError)
    expect(collector.snapshot()).toMatchObject({ totalTokens: 0, usageMissing: true, pendingCalls: 0 })
  })

  it('releases a provider rejection and includes known usage even from a failed attempt', () => {
    const collector = createTutorUsageCollector({ maxTotalTokens: estimateTutorInputTokens(payload) + 100 })
    collector.forPurpose('main_reply').start(attempt).finish({ usage: null, status: 'rejected' })
    const fallback = collector.forPurpose('main_reply').start(attempt)
    fallback.finish({ usage: { promptTokens: 20, completionTokens: 5 }, status: 'failed' })
    expect(collector.snapshot()).toMatchObject({ totalTokens: 25, usageMissing: false, pendingCalls: 0 })
  })

  it('limits the main answer output without starting an optional call it cannot afford', () => {
    const budget = estimateTutorInputTokens(payload) + 27
    const collector = createTutorUsageCollector({ maxTotalTokens: budget })
    expect(() => collector.forPurpose('tool_planner').start(attempt)).toThrow(TutorUsageBudgetError)
    expect(collector.snapshot().calls).toHaveLength(0)
    expect(collector.forPurpose('main_reply').start(attempt).maxOutputTokens).toBe(27)
  })

  it('accounts for image inputs separately and refuses oversized work before it starts', () => {
    const imagePayload = { messages: [{ role: 'user', content: [
      { type: 'text', text: '这是什么？' },
      { type: 'image_url', image_url: { url: 'https://example.test/photo.png' } },
    ] }], max_tokens: 256 }
    expect(estimateTutorInputTokens(imagePayload)).toBeGreaterThan(TUTOR_IMAGE_INPUT_RESERVE_TOKENS)
    const collector = createTutorUsageCollector({ maxTotalTokens: 1000 })
    expect(() => collector.forPurpose('scratch_diagnosis').start({ ...attempt, payload: imagePayload }))
      .toThrow(TutorUsageBudgetError)
    expect(collector.snapshot().calls).toHaveLength(0)
  })

  it('records actual overruns and blocks further calls instead of charging estimates', () => {
    const collector = createTutorUsageCollector({ maxTotalTokens: 1000 })
    collector.forPurpose('main_reply').start(attempt).finish({ usage: { totalTokens: 1500 }, status: 'completed' })
    expect(collector.snapshot()).toMatchObject({ totalTokens: 1500, budgetExceeded: true })
    expect(() => collector.forPurpose('audio_planner').start(attempt)).toThrow(TutorUsageBudgetError)
  })

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects an invalid request budget %s', (maxTotalTokens) => {
    expect(() => createTutorUsageCollector({ maxTotalTokens })).toThrow('Invalid tutor request budget')
  })
})

describe('confirmed switch to a request free allowance', () => {
  const largeAttempt = { ...attempt, payload: { ...payload, messages: [{ role: 'user', content: '课程资料'.repeat(400) }] } }

  it('shares one recovery and keeps verified, unknown and in-flight reservations', async () => {
    let confirm!: (value: { maxTotalTokens: number }) => void
    const onBudgetExceeded = vi.fn(() => new Promise<{ maxTotalTokens: number }>((resolve) => { confirm = resolve }))
    const collector = createTutorUsageCollector({ maxTotalTokens: 2000, onBudgetExceeded })
    collector.forPurpose('resource_planner').start(attempt).finish({ usage: { totalTokens: 200 }, status: 'completed' })
    collector.forPurpose('tool_planner').start(attempt).finish({ usage: null, status: 'completed' })
    const pending = collector.forPurpose('audio_planner').start(attempt)
    const main = collector.forPurpose('main_reply')
    expect(() => main.start(largeAttempt)).toThrow(TutorUsageBudgetError)
    const first = main.recoverBudget!(largeAttempt, new TutorUsageBudgetError())
    const concurrent = main.recoverBudget!(largeAttempt, new TutorUsageBudgetError())
    expect(onBudgetExceeded).toHaveBeenCalledTimes(1)
    expect(onBudgetExceeded).toHaveBeenCalledWith(200 + 2 * (estimateTutorInputTokens(payload) + 100) + estimateTutorInputTokens(largeAttempt.payload) + 1)
    expect(collector.snapshot()).toMatchObject({ totalTokens: 200, pendingCalls: 1, usageMissing: true })
    expect(collector.snapshot().calls).toHaveLength(3)
    pending.finish({ usage: { totalTokens: 100 }, status: 'completed' })
    confirm({ maxTotalTokens: 131_072 })
    expect(await first).toBe(true)
    expect(await concurrent).toBe(true)
    main.start(largeAttempt).finish({ usage: { totalTokens: 4000 }, status: 'completed' })
    expect(collector.snapshot()).toMatchObject({ totalTokens: 4300, pendingCalls: 0, usageMissing: true, budgetDeniedCalls: 1 })
    expect(collector.snapshot().calls).toHaveLength(4)
  })

  it.each(['declined', 'unconfirmed'])('does not expand or repeatedly request a %s allowance', async (kind) => {
    const onBudgetExceeded = vi.fn(async () => {
      if (kind === 'unconfirmed') throw new Error('RPC response lost')
      return null
    })
    const collector = createTutorUsageCollector({ maxTotalTokens: 1000, onBudgetExceeded })
    const main = collector.forPurpose('main_reply')
    expect(() => main.start(largeAttempt)).toThrow(TutorUsageBudgetError)
    expect(await main.recoverBudget!(largeAttempt, new TutorUsageBudgetError())).toBe(false)
    expect(await main.recoverBudget!(largeAttempt, new TutorUsageBudgetError())).toBe(false)
    expect(() => main.start(largeAttempt)).toThrow(TutorUsageBudgetError)
    expect(onBudgetExceeded).toHaveBeenCalledTimes(1)
    expect(collector.snapshot().calls).toHaveLength(0)
  })

  it('does not claim free quota for optional calls, a full-size request, or work exceeding that full size', async () => {
    const onBudgetExceeded = vi.fn(async () => ({ maxTotalTokens: 131_072 }))
    const collector = createTutorUsageCollector({ maxTotalTokens: 1000, onBudgetExceeded })
    expect(collector.forPurpose('resource_planner').recoverBudget).toBeUndefined()
    const oversized = { ...attempt, payload: { ...payload, messages: [{ role: 'user', content: '字'.repeat(50_000) }] } }
    expect(await collector.forPurpose('main_reply').recoverBudget!(oversized, new TutorUsageBudgetError())).toBe(false)
    const full = createTutorUsageCollector({ maxTotalTokens: 131_072, onBudgetExceeded })
    expect(await full.forPurpose('main_reply').recoverBudget!(oversized, new TutorUsageBudgetError())).toBe(false)
    expect(await collector.forPurpose('main_reply').recoverBudget!(largeAttempt, new Error('not a budget failure'))).toBe(false)
    expect(onBudgetExceeded).not.toHaveBeenCalled()
  })

  it('re-evaluates the active overrun block after confirmation without erasing its audit history', async () => {
    const onBudgetExceeded = vi.fn(async () => ({ maxTotalTokens: 131_072 }))
    const collector = createTutorUsageCollector({ maxTotalTokens: 1000, onBudgetExceeded })
    collector.forPurpose('resource_planner').start(attempt).finish({ usage: { totalTokens: 2000 }, status: 'completed' })
    const main = collector.forPurpose('main_reply')
    expect(() => main.start(attempt)).toThrow(TutorUsageBudgetError)
    expect(await main.recoverBudget!(attempt, new TutorUsageBudgetError())).toBe(true)
    expect(() => main.start(attempt)).not.toThrow()
    expect(collector.snapshot()).toMatchObject({ totalTokens: 2000, budgetExceeded: true, budgetDeniedCalls: 1, pendingCalls: 1 })
  })

  it.each([1000, 2000, 131_073])('does not trust an invalid or insufficient confirmed budget %s', async (maxTotalTokens) => {
    const onBudgetExceeded = vi.fn(async () => ({ maxTotalTokens }))
    const collector = createTutorUsageCollector({ maxTotalTokens: 1000, onBudgetExceeded })
    const main = collector.forPurpose('main_reply')
    expect(await main.recoverBudget!(largeAttempt, new TutorUsageBudgetError())).toBe(false)
    expect(() => main.start(largeAttempt)).toThrow(TutorUsageBudgetError)
  })
})
