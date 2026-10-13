import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-a' } as { id: string } | null,
  fetch: vi.fn(),
  toast: vi.fn(),
  query: { setQueryData: vi.fn(), invalidateQueries: vi.fn() },
}))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => mocks.query }))

import { useTutorHistory } from './use-tutor-history'
import { useTutorChatStream, type UseTutorChatStreamOptions } from './use-tutor-chat-stream'

function options(): UseTutorChatStreamOptions {
  return {
    epoch: 0, contextKey: 'home', context: { contextType: 'global', contextId: '', surface: 'home' },
    sessionInput: { userId: 'user-a', contextType: 'global', contextId: '' },
    busyRef: { current: false }, autoReadReplies: false,
    beginStreamedSpeech: vi.fn().mockResolvedValue(undefined), pushStreamedPcm: vi.fn(),
    finishStreamedSpeech: vi.fn(), playSpeech: vi.fn(), setQuota: vi.fn(),
    refreshQuota: vi.fn(), setMascotFeedback: vi.fn(), onBeforeSend: vi.fn(), onStopSpeech: vi.fn(),
  }
}
function response(events: unknown[]) {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''))
}

describe('tutor chat lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch.mockReset()
    mocks.user = { id: 'user-a' }
    vi.stubGlobal('fetch', mocks.fetch)
  })

  it('carries completed messages across loading, sends in the new scene, and clears on a new topic or account', async () => {
    mocks.fetch.mockImplementation(async () => response([{ type: 'done', reply: '上一页答案' }]))
    const opts = options()
    const { result, rerender } = renderHook((props: { key: string; epoch?: number; title?: string }) => useTutorChatStream({
      ...opts, contextKey: props.key, epoch: props.epoch, sceneTitle: props.title,
      context: { contextType: 'project', contextId: props.key },
    }), { initialProps: { key: '1', epoch: 0, title: '旧页' } as { key: string; epoch?: number; title?: string } })
    await act(async () => { await result.current.sendMessage('旧问题') })
    rerender({ key: '2' })
    expect(result.current.displayMessages.map((m) => m.content)).toEqual(['旧问题', '上一页答案', '现在在：新页面'])
    rerender({ key: '2', epoch: 0, title: '新项目' })
    expect(result.current.displayMessages.at(-1)?.content).toBe('现在在：新项目')
    await act(async () => { await result.current.sendMessage('接着说') })
    expect(result.current.displayMessages.filter((m) => m.content === '上一页答案')).toHaveLength(2)
    expect(JSON.parse(mocks.fetch.mock.calls.at(-1)![1].body)).toMatchObject({ contextId: '2', previousContext: { contextType: 'project', contextId: '1' } })
    act(() => result.current.resetChat())
    expect(result.current.displayMessages).toEqual([])
    await act(async () => { await result.current.sendMessage('新话题') })
    expect(JSON.parse(mocks.fetch.mock.calls.at(-1)![1].body).previousContext).toBeUndefined()
    rerender({ key: '3', epoch: 0 })
    expect(result.current.hasCarried).toBe(true)
    mocks.user = { id: 'user-b' }
    rerender({ key: '3', epoch: 0 })
    expect(result.current.displayMessages).toEqual([])
  })

  it('startNewTopic clears the carried segment after successful archiving', async () => {
    const opts = options()
    const contextKeyRef = { current: 'home' }
    const { result, rerender } = renderHook(({ key }) => {
      const chat = useTutorChatStream({ ...opts, contextKey: key })
      const history = useTutorHistory({ epoch: 0, contextKey: key, contextKeyRef, busyRef: opts.busyRef,
        contextType: 'global', contextId: '', buildParams: () => new URLSearchParams(),
        loadSession: async () => undefined, onResetChat: chat.resetChat })
      return { chat, history }
    }, { initialProps: { key: 'home' } })
    act(() => result.current.chat.setMessages([{ role: 'assistant', content: '上一页' }]))
    contextKeyRef.current = 'next'
    rerender({ key: 'next' })
    expect(result.current.chat.hasCarried).toBe(true)
    mocks.fetch.mockResolvedValue(new Response('{}'))
    await act(async () => { await result.current.history.startNewTopic() })
    expect(result.current.chat.displayMessages).toEqual([])
    expect(result.current.chat.hasCarried).toBe(false)
  })

  it('releases a switched scene and ignores an old failure while its replacement is streaming', async () => {
    let rejectOld!: (error: Error) => void
    let stream!: ReadableStreamDefaultController<Uint8Array>
    mocks.fetch.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject }))
      .mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) { stream = controller } })))
    const opts = options()
    const { result, rerender } = renderHook(({ key }) => useTutorChatStream({ ...opts, contextKey: key }), { initialProps: { key: 'home' } })
    let oldRequest!: Promise<void>
    act(() => { oldRequest = result.current.sendMessage('旧问题') })
    expect(result.current.busy).toBe(true)
    rerender({ key: 'explore' })
    expect(result.current.busy).toBe(false)
    expect(result.current.messages).toEqual([])
    let nextRequest!: Promise<void>
    await act(async () => { nextRequest = result.current.sendMessage('新问题') })
    await act(async () => { rejectOld(new Error('old network error')); await oldRequest })
    expect(result.current.busy).toBe(true)
    expect(result.current.messages.map((message) => message.content)).toEqual(['新问题', ''])
    await act(async () => {
      stream.enqueue(new TextEncoder().encode('data: {"type":"done","reply":"新答案"}\n\n'))
      stream.close()
      await nextRequest
    })
    expect(result.current.busy).toBe(false)
    expect(result.current.messages.at(-1)?.content).toBe('新答案')
  })

  it('clears private messages on passive auth loss without needing a scene change', async () => {
    mocks.fetch.mockResolvedValue(response([{ type: 'done', reply: '私人回复' }]))
    const opts = options()
    const { result, rerender } = renderHook(() => useTutorChatStream(opts))
    await act(async () => { await result.current.sendMessage('我的记录') })
    expect(result.current.messages).toHaveLength(2)
    mocks.user = null
    rerender()
    expect(result.current.messages).toEqual([])
    expect(result.current.busy).toBe(false)
  })

  it('stops receiving, releases input and leaves a truthful stopped marker', async () => {
    let rejectRequest!: (error: Error) => void
    mocks.fetch.mockReturnValue(new Promise((_resolve, reject) => { rejectRequest = reject }))
    const opts = options()
    const { result } = renderHook(() => useTutorChatStream(opts))
    let request!: Promise<void>
    act(() => { request = result.current.sendMessage('帮帮我') })
    act(() => { result.current.stopGeneration() })
    expect(result.current.busy).toBe(false)
    expect(result.current.messages.at(-1)).toMatchObject({ stopped: true, streaming: false })
    expect(opts.onStopSpeech).toHaveBeenCalledOnce()
    expect((mocks.fetch.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
    await act(async () => { rejectRequest(new Error('aborted')); await request })
    expect(result.current.messages.at(-1)?.stopped).toBe(true)
  })

  it('treats an incomplete stream as uncertain failure instead of successful empty text', async () => {
    mocks.fetch.mockResolvedValue(response([{ type: 'chunk', content: '收到的部分回复' }]))
    const opts = options()
    const { result } = renderHook(() => useTutorChatStream(opts))
    await act(async () => { await result.current.sendMessage('问题') })
    expect(result.current.messages.at(-1)).toMatchObject({ error: true })
    expect(result.current.messages.at(-1)?.content).toContain('收到的部分回复')
    expect(result.current.failedMessage).toMatchObject({ text: '问题', retryable: true })
    expect(mocks.query.setQueryData).not.toHaveBeenCalled()
  })

  it('retries a confirmed failed question with its original images', async () => {
    mocks.fetch.mockResolvedValueOnce(response([{ type: 'error', error: '生成失败', requestState: 'failed' }]))
      .mockResolvedValueOnce(response([{ type: 'done', reply: '已收到图片' }]))
    const opts = options()
    const { result } = renderHook(() => useTutorChatStream(opts))
    await act(async () => { await result.current.sendMessage('看看这里', ['https://example.invalid/photo.jpg']) })
    expect(result.current.failedMessage?.retryable).toBe(true)
    await act(async () => { await result.current.retryLastMessage() })
    const body = JSON.parse(mocks.fetch.mock.calls[1][1].body)
    expect(body).toMatchObject({ content: '看看这里', images: ['https://example.invalid/photo.jpg'] })
    expect(body.requestId).not.toBe(JSON.parse(mocks.fetch.mock.calls[0][1].body).requestId)
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.failedMessage).toBeNull()
    expect(result.current.messages.at(-1)?.content).toBe('已收到图片')
  })

  it('reuses the entire request snapshot after uncertain transport failure even if page tools changed', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(response([{ type: 'done', reply: '已保存的回复', replayed: true }]))
    const opts = options()
    const { result, rerender } = renderHook(({ step }) => useTutorChatStream({ ...opts, lessonStepIndex: step }), { initialProps: { step: 0 } })
    await act(async () => { await result.current.sendMessage('这个步骤', ['https://example.invalid/photo.jpg']) })
    const original = mocks.fetch.mock.calls[0][1].body
    rerender({ step: 3 })
    await act(async () => { await result.current.retryLastMessage() })
    expect(mocks.fetch.mock.calls[1][1].body).toBe(original)
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages.at(-1)?.content).toBe('已保存的回复')
  })

  it('restores a replay without duplicating refetched history or leaving speech in loading state', async () => {
    const billing = { source: 'wallet' as const, chargedCredits: .1, receiptId: 8 }
    mocks.fetch.mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValueOnce(response([{ type: 'done', reply: '已保存的回复', replayed: true, billing }]))
    const opts = { ...options(), autoReadReplies: true }
    vi.mocked(opts.finishStreamedSpeech).mockReturnValue(false)
    const { result } = renderHook(() => useTutorChatStream(opts))
    await act(async () => { await result.current.sendMessage('问题') })
    const requestId = JSON.parse(mocks.fetch.mock.calls[0][1].body).requestId
    const persisted = [{ role: 'user' as const, content: '问题', requestId }, { role: 'assistant' as const, content: '已保存的回复', requestId, billing }]
    act(() => { result.current.setMessages(persisted) })
    mocks.query.setQueryData.mockClear()
    vi.mocked(opts.finishStreamedSpeech).mockClear()
    await act(async () => { await result.current.retryLastMessage() })
    expect(result.current.messages).toHaveLength(2)
    expect(opts.finishStreamedSpeech).toHaveBeenCalledOnce()
    expect(opts.playSpeech).not.toHaveBeenCalled()
    const update = mocks.query.setQueryData.mock.calls[0][1]
    expect(update({ epoch: 0, messages: persisted }).messages).toHaveLength(2)
    const newer = { epoch: 1, messages: [] }
    expect(update(newer)).toBe(newer)
  })

  it('invalidates an old stream when another tab refreshes the session to a newer topic epoch', async () => {
    let resolve!: (res: Response) => void
    mocks.fetch.mockReturnValue(new Promise((r) => { resolve = r }))
    const opts = options()
    const { result, rerender } = renderHook(({ epoch }) => useTutorChatStream({ ...opts, epoch }), { initialProps: { epoch: 0 } })
    let pending!: Promise<void>
    act(() => { pending = result.current.sendMessage('旧问题') })
    rerender({ epoch: 1 })
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => { resolve(response([{ type: 'done', reply: '旧答案' }])); await pending })
    expect(result.current.messages).toEqual([])
    expect(mocks.query.setQueryData).not.toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
  })

  it('does not restart speech after course controls take over and old PCM arrives', async () => {
    mocks.fetch.mockResolvedValue(response([
      { type: 'audio', pcm: 'AAAA', sampleRate: 24000 },
      { type: 'audio_done' },
      { type: 'done', reply: '这段文字仍然保留。' },
    ]))
    const opts = { ...options(), autoReadReplies: true }
    vi.mocked(opts.pushStreamedPcm).mockReturnValue(null)
    vi.mocked(opts.finishStreamedSpeech).mockReturnValue(null)
    const { result } = renderHook(() => useTutorChatStream(opts))

    await act(async () => { await result.current.sendMessage('帮我看看') })

    expect(opts.pushStreamedPcm).toHaveBeenCalled()
    expect(opts.playSpeech).not.toHaveBeenCalled()
    expect(result.current.messages.at(-1)?.content).toBe('这段文字仍然保留。')
  })

  it('does not automatically synthesize again after a failed chat speech stream', async () => {
    mocks.fetch.mockResolvedValue(response([
      { type: 'audio', pcm: 'AAAA', sampleRate: 24000 },
      { type: 'done', reply: '可以重新播放的答复。' },
    ]))
    const opts = { ...options(), autoReadReplies: true }
    vi.mocked(opts.pushStreamedPcm).mockReturnValue(false)
    vi.mocked(opts.finishStreamedSpeech).mockReturnValue(false)
    const { result } = renderHook(() => useTutorChatStream(opts))

    await act(async () => { await result.current.sendMessage('帮我看看') })

    expect(opts.playSpeech).not.toHaveBeenCalled()
  })

  it('keeps an in-progress retry on its original request identity', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: '处理中', requestState: 'processing' }), { status: 409 }))
      .mockResolvedValueOnce(response([{ type: 'done', reply: '原请求的回复', replayed: true }]))
    const opts = options()
    const { result } = renderHook(() => useTutorChatStream(opts))
    await act(async () => { await result.current.sendMessage('问题') })
    await act(async () => { await result.current.retryLastMessage() })
    expect(mocks.fetch.mock.calls[1][1].body).toBe(mocks.fetch.mock.calls[0][1].body)
  })

  it('retains completed answer billing in local messages and the session cache', async () => {
    const billing = { source: 'wallet', chargedCredits: 0.123, receiptId: 7 }
    mocks.fetch.mockResolvedValue(response([{ type: 'done', reply: '已完成', billing }]))
    const opts = options()
    const { result } = renderHook(() => useTutorChatStream(opts))

    await act(async () => { await result.current.sendMessage('问题') })

    expect(result.current.messages.at(-1)).toMatchObject({ content: '已完成', billing })
    expect(mocks.query.setQueryData).toHaveBeenCalledWith(
      ['tutor-session', 'user-a', 'global', '', null, null, null, null],
      expect.any(Function),
    )
  })

  it('does not resurrect a reply after resetting to a new topic', async () => {
    let resolveRequest!: (res: Response) => void
    mocks.fetch.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    const opts = options()
    const { result } = renderHook(() => useTutorChatStream(opts))
    let request!: Promise<void>
    act(() => { request = result.current.sendMessage('上一话题') })
    act(() => { result.current.resetChat() })
    await act(async () => { resolveRequest(response([{ type: 'done', reply: '旧答案' }])); await request })
    expect(result.current.messages).toEqual([])
    expect(result.current.busy).toBe(false)
  })
})
