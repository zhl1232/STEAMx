import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dashScopeChatComplete, resetDashScopeModelState } from '@/lib/ai/dashscope'
import {
  chatWithTutorComplete,
  getTutorEngineUserMessage,
  streamChatWithTutor,
  summarizeConversationWindow,
  summarizeNotebook,
} from '@/lib/ai/tutor/engine'
import { planTutorResourceSearch } from '@/lib/ai/tutor/resource-search-planner'
import { createTutorUsageCollector, TUTOR_USAGE_BUDGET_MESSAGE } from '@/lib/ai/tutor/usage'
import { logger } from '@/lib/logger'

const fetchMock = vi.fn()
const envKeys = ['DASHSCOPE_API_KEY', 'DASHSCOPE_MODEL_AUTO_SWITCH', 'DASHSCOPE_MODEL_DISCOVERY', 'DASHSCOPE_TUTOR_TEXT_MODELS'] as const
const priorEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

function completion(text: string, usage?: Record<string, unknown>) {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }], ...(usage ? { usage } : {}) }))
}

function event(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

async function drain(options: Parameters<typeof streamChatWithTutor>[2], images?: string[]) {
  const result: string[] = []
  for await (const chunk of streamChatWithTutor('你是小迪。', [{ role: 'user', content: '继续', images }], options)) result.push(chunk)
  return result.join('')
}

describe('provider attempt usage capture', () => {
  beforeEach(() => {
    process.env.DASHSCOPE_API_KEY = 'test-key'
    process.env.DASHSCOPE_MODEL_AUTO_SWITCH = 'false'
    process.env.DASHSCOPE_MODEL_DISCOVERY = 'false'
    delete process.env.DASHSCOPE_TUTOR_TEXT_MODELS
    resetDashScopeModelState()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetDashScopeModelState()
    for (const key of envKeys) {
      if (priorEnv[key] === undefined) delete process.env[key]
      else process.env[key] = priorEnv[key]
    }
  })

  it('records a planner protocol retry even though its first result is discarded', async () => {
    fetchMock
      .mockResolvedValueOnce(completion('格式错误的规划', { prompt_tokens: 300, completion_tokens: 20, total_tokens: 320 }))
      .mockResolvedValueOnce(completion('{"shouldSearch":false}', { prompt_tokens: 350, completion_tokens: 30, total_tokens: 380 }))
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    await expect(planTutorResourceSearch('继续搭建', { usageObserver: collector.forPurpose('resource_planner') }))
      .resolves.toMatchObject({ status: 'model', shouldSearch: false })
    expect(collector.snapshot()).toMatchObject({ totalTokens: 700, inputTokens: 650, outputTokens: 50, pendingCalls: 0 })
    expect(collector.snapshot().calls).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('records each model fallback attempt and counts provider usage returned with an error', async () => {
    process.env.DASHSCOPE_MODEL_AUTO_SWITCH = 'true'
    process.env.DASHSCOPE_TUTOR_TEXT_MODELS = 'first-model,second-model'
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'model unavailable' }, usage: { total_tokens: 17 } }), { status: 503 }))
      .mockResolvedValueOnce(completion('完成。', { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 }))
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    await dashScopeChatComplete({ role: 'tutor-text', payload: { messages: [], max_tokens: 100 }, usageObserver: collector.forPurpose('main_reply') })
    expect(collector.snapshot()).toMatchObject({ totalTokens: 77, usageMissing: false, pendingCalls: 0 })
    expect(collector.snapshot().calls.map((call) => [call.model, call.status, call.totalTokens]))
      .toEqual([['first-model', 'failed', 17], ['second-model', 'completed', 60]])
  })

  it('records complete-response usage before reasoning sanitization can reject an empty answer', async () => {
    fetchMock.mockResolvedValue(completion('<think>只有内部推理</think>', {
      prompt_tokens: 80, completion_tokens: 20, total_tokens: 100, completion_tokens_details: { reasoning_tokens: 20 },
    }))
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    await expect(chatWithTutorComplete('你是小迪', [{ role: 'user', content: '继续' }], { usageObserver: collector.forPurpose('tool_planner') }))
      .rejects.toThrow('Empty tutor reply')
    expect(collector.snapshot()).toMatchObject({ totalTokens: 100, outputTokens: 20, pendingCalls: 0 })
  })

  it('settles stream usage exactly once, including final usage without a newline and reasoning tokens', async () => {
    fetchMock.mockResolvedValue(new Response(
      event({ choices: [{ delta: { content: '<think>内部</think>这是回答。', reasoning_content: '思考' }, finish_reason: 'stop' }] }) +
      event({ usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 } }) +
      `data: ${JSON.stringify({ usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130, completion_tokens_details: { reasoning_tokens: 10 } } })}`,
    ))
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    await expect(drain({ usageObserver: collector.forPurpose('main_reply') })).resolves.toBe('这是回答。')
    expect(collector.snapshot()).toMatchObject({ totalTokens: 130, outputTokens: 30, pendingCalls: 0, usageMissing: false })
    expect(collector.snapshot().calls).toHaveLength(1)
  })

  it('keeps the failed visual stream usage when its text fallback succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(event({ choices: [{ delta: {}, finish_reason: 'content_filter' }], usage: { total_tokens: 40 } }) + 'data: [DONE]\n\n'))
      .mockResolvedValueOnce(new Response(event({ choices: [{ delta: { content: '请用文字描述。' }, finish_reason: 'stop' }], usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 } })))
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    await expect(drain({ usageObserver: collector.forPurpose('main_reply') }, ['https://example.test/image.png']))
      .resolves.toBe('请用文字描述。')
    expect(collector.snapshot()).toMatchObject({ totalTokens: 100, pendingCalls: 0 })
    expect(collector.snapshot().calls.map((call) => call.status)).toEqual(['failed', 'completed'])
  })

  it('retains known usage when a stream body fails after a usage chunk', async () => {
    let reads = 0
    fetchMock.mockResolvedValue(new Response(new ReadableStream({
      pull(controller) {
        if (reads++ === 0) controller.enqueue(new TextEncoder().encode(event({ usage: { total_tokens: 70 } })))
        else controller.error(new Error('provider disconnected'))
      },
    })))
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    await expect(drain({ usageObserver: collector.forPurpose('main_reply') })).rejects.toThrow('provider disconnected')
    expect(collector.snapshot()).toMatchObject({ totalTokens: 70, pendingCalls: 0 })
    expect(collector.snapshot().calls[0].status).toBe('failed')
  })

  it('finalizes an attempt with a missing stream body', async () => {
    fetchMock.mockResolvedValue(new Response(null))
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    await expect(drain({ usageObserver: collector.forPurpose('main_reply') })).rejects.toThrow('missing body')
    expect(collector.snapshot()).toMatchObject({ totalTokens: 0, usageMissing: true, pendingCalls: 0 })
  })

  it('finalizes an attempt even when a stream reader cannot be acquired', async () => {
    const response = new Response('locked')
    const lock = response.body!.getReader()
    fetchMock.mockResolvedValue(response)
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    await expect(drain({ usageObserver: collector.forPurpose('main_reply') })).rejects.toThrow()
    expect(collector.snapshot()).toMatchObject({ totalTokens: 0, usageMissing: true, pendingCalls: 0 })
    lock.releaseLock()
  })

  it('finalizes invalid JSON and network failures without inventing usage', async () => {
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    fetchMock.mockResolvedValueOnce(new Response('not JSON'))
    await expect(chatWithTutorComplete('小迪', [{ role: 'user', content: '你好' }], { usageObserver: collector.forPurpose('main_reply') }))
      .rejects.toThrow('Empty tutor reply')
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
    await expect(dashScopeChatComplete({ role: 'tutor-planner', payload: { messages: [], max_tokens: 100 }, usageObserver: collector.forPurpose('resource_planner') }))
      .rejects.toMatchObject({ code: 'timeout' })
    expect(collector.snapshot()).toMatchObject({ totalTokens: 0, usageMissing: true, pendingCalls: 0 })
    expect(collector.snapshot().calls).toHaveLength(2)
  })

  it('captures both bounded memory calls, including a summary discarded after sanitization', async () => {
    fetchMock
      .mockResolvedValueOnce(completion('学生喜欢积木。', { prompt_tokens: 400, completion_tokens: 25, total_tokens: 425 }))
      .mockResolvedValueOnce(completion('<think>没有摘要</think>', { prompt_tokens: 300, completion_tokens: 15, total_tokens: 315 }))
    const collector = createTutorUsageCollector({ maxTotalTokens: 131_072 })
    expect(await summarizeNotebook('', [{ role: 'user', content: '我喜欢积木' }], 1200, { usageObserver: collector.forPurpose('notebook_summary') }))
      .toBe('学生喜欢积木。')
    expect(await summarizeConversationWindow('', [{ role: 'user', content: '继续' }], { usageObserver: collector.forPurpose('conversation_summary') }))
      .toBeNull()
    expect(collector.snapshot()).toMatchObject({ totalTokens: 740, pendingCalls: 0 })
    expect(fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).max_tokens)).toEqual([1800, 800])
  })

  it('skips unaffordable optional planning and returns a currency-only main-answer error before any provider call', async () => {
    const collector = createTutorUsageCollector({ maxTotalTokens: 1 })
    await expect(planTutorResourceSearch('继续', { usageObserver: collector.forPurpose('resource_planner') })).resolves.toMatchObject({ status: 'fallback' })
    const onVisionFallback = vi.fn()
    try {
      await drain({ usageObserver: collector.forPurpose('main_reply'), onVisionFallback }, ['https://example.test/image.png'])
      throw new Error('expected budget rejection')
    } catch (error) {
      expect(getTutorEngineUserMessage(error)).toBe(TUTOR_USAGE_BUDGET_MESSAGE)
      expect(getTutorEngineUserMessage(error)).not.toMatch(/token/i)
    }
    expect(onVisionFallback).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(collector.snapshot()).toMatchObject({ calls: [], pendingCalls: 0, totalTokens: 0 })
  })

  it('waits for the same request free-quota confirmation before its main call and never reruns an earlier planner', async () => {
    let confirm!: (value: { maxTotalTokens: number }) => void
    const onBudgetExceeded = vi.fn(() => new Promise<{ maxTotalTokens: number }>((resolve) => { confirm = resolve }))
    const collector = createTutorUsageCollector({ maxTotalTokens: 2000, onBudgetExceeded })
    fetchMock
      .mockResolvedValueOnce(completion('规划完成', { prompt_tokens: 180, completion_tokens: 20, total_tokens: 200 }))
      .mockResolvedValueOnce(new Response(event({ choices: [{ delta: { content: '可以继续搭建。' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 4000, completion_tokens: 20, total_tokens: 4020 } })))
    await dashScopeChatComplete({ role: 'tutor-planner', payload: { messages: [], max_tokens: 100 }, usageObserver: collector.forPurpose('tool_planner') })
    const stream = streamChatWithTutor('课程资料'.repeat(400), [{ role: 'user', content: '继续' }], {
      maxTokens: 8192, usageObserver: collector.forPurpose('main_reply'),
    })
    const firstChunk = stream.next()
    await vi.waitFor(() => expect(onBudgetExceeded).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(collector.snapshot().calls).toHaveLength(1)
    confirm({ maxTotalTokens: 131_072 })
    expect(await firstChunk).toMatchObject({ value: '可以继续搭建。', done: false })
    expect(await stream.next()).toMatchObject({ value: '可以继续搭建。', done: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(collector.snapshot()).toMatchObject({ totalTokens: 4220, pendingCalls: 0, budgetDeniedCalls: 1 })
    expect(collector.snapshot().calls.map((call) => call.purpose)).toEqual(['tool_planner', 'main_reply'])
  })

  it.each(['no_free_quota', 'response_unconfirmed'])('does not send the main request after %s', async (kind) => {
    const onBudgetExceeded = vi.fn(async () => {
      if (kind === 'response_unconfirmed') throw new Error('RPC unavailable')
      return null
    })
    const collector = createTutorUsageCollector({ maxTotalTokens: 1, onBudgetExceeded })
    await expect(drain({ usageObserver: collector.forPurpose('main_reply') })).rejects.toMatchObject({ status: 402 })
    expect(onBudgetExceeded).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(collector.snapshot().calls).toHaveLength(0)
  })
})
