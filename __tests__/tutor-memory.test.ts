import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import {
  maybeUpdateTutorConversationSummary,
  maybeUpdateTutorNotebook,
  resolveNotebookCharLimit,
} from '@/lib/ai/tutor/memory'
import { summarizeConversationWindow, summarizeNotebook } from '@/lib/ai/tutor/engine'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: fromMock },
}))

vi.mock('@/lib/ai/tutor/engine', () => ({
  summarizeNotebook: vi.fn(),
  summarizeConversationWindow: vi.fn(),
}))

const summarizeNotebookMock = summarizeNotebook as Mock<typeof summarizeNotebook>
const summarizeConversationWindowMock = summarizeConversationWindow as Mock<typeof summarizeConversationWindow>

type QueryResponse = { data?: unknown; error?: unknown; count?: number | null }

/** 记录链式调用参数、可 await、可 maybeSingle 的查询桩 */
function createQuery(response: QueryResponse) {
  const calls: Record<string, unknown[][]> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  const record = (name: string) => {
    return (...args: unknown[]) => {
      ;(calls[name] ??= []).push(args)
      return chain
    }
  }
  for (const method of ['select', 'eq', 'gt', 'is', 'order', 'limit', 'update', 'upsert', 'insert']) {
    chain[method] = record(method)
  }
  chain.maybeSingle = () => Promise.resolve(response)
  chain.then = (
    onFulfilled?: (value: QueryResponse) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(onFulfilled, onRejected)
  return { chain, calls }
}

function queueQueries(queues: Record<string, Array<ReturnType<typeof createQuery>>>) {
  fromMock.mockImplementation((table: string) => {
    const next = queues[table]?.shift()
    if (!next) throw new Error(`Unexpected query for table: ${table}`)
    return next.chain
  })
}

function buildMessages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `消息${i + 1}`,
  }))
}

beforeEach(() => {
  fromMock.mockReset()
  summarizeNotebookMock.mockReset()
  summarizeConversationWindowMock.mockReset()
})

describe('resolveNotebookCharLimit', () => {
  it('按累计消息量分级放宽上限', () => {
    expect(resolveNotebookCharLimit(0)).toBe(600)
    expect(resolveNotebookCharLimit(299)).toBe(600)
    expect(resolveNotebookCharLimit(300)).toBe(900)
    expect(resolveNotebookCharLimit(799)).toBe(900)
    expect(resolveNotebookCharLimit(800)).toBe(1200)
  })
})

describe('maybeUpdateTutorConversationSummary', () => {
  it('窗口外消息不足最小批量时不触发摘要', async () => {
    // 14 条：窗口 12，溢出 2 < 4
    const conversationSelect = createQuery({ data: { summary: '', summary_message_id: null } })
    const messagesSelect = createQuery({ data: buildMessages(14), error: null })
    queueQueries({
      tutor_conversations: [conversationSelect],
      tutor_messages: [messagesSelect],
    })

    await maybeUpdateTutorConversationSummary('conv-1', 'user-1')

    expect(summarizeConversationWindowMock).not.toHaveBeenCalled()
  })

  it('只折叠滑出窗口的最旧消息，并推进摘要锚点', async () => {
    // 18 条：溢出 6 ≥ 4，应折叠 id 1-6
    const conversationSelect = createQuery({ data: { summary: '旧摘要', summary_message_id: null } })
    const messagesSelect = createQuery({ data: buildMessages(18), error: null })
    const conversationUpdate = createQuery({ error: null })
    queueQueries({
      tutor_conversations: [conversationSelect, conversationUpdate],
      tutor_messages: [messagesSelect],
    })
    summarizeConversationWindowMock.mockResolvedValue('新摘要')

    await maybeUpdateTutorConversationSummary('conv-1', 'user-1')

    expect(summarizeConversationWindowMock).toHaveBeenCalledOnce()
    const [previousSummary, folded] = summarizeConversationWindowMock.mock.calls[0]
    expect(previousSummary).toBe('旧摘要')
    expect(folded).toHaveLength(6)
    expect(folded[0]).toEqual({ role: 'user', content: '消息1' })
    expect(folded[5]).toEqual({ role: 'assistant', content: '消息6' })

    expect(conversationUpdate.calls.update?.[0]?.[0]).toEqual({
      summary: '新摘要',
      summary_message_id: 6,
    })
    // 首次摘要：锚点为空，用 is null 做乐观并发
    expect(conversationUpdate.calls.is?.[0]).toEqual(['summary_message_id', null])
    expect(conversationUpdate.calls.eq?.[0]).toEqual(['id', 'conv-1'])
  })

  it('已有锚点时从锚点续读，并用锚点值做乐观并发', async () => {
    const conversationSelect = createQuery({ data: { summary: '旧摘要', summary_message_id: 6 } })
    // 锚点之后 16 条（id 7-22）：溢出 4 ≥ 4，折叠 id 7-10
    const rows = Array.from({ length: 16 }, (_, i) => ({
      id: i + 7,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `消息${i + 7}`,
    }))
    const messagesSelect = createQuery({ data: rows, error: null })
    const conversationUpdate = createQuery({ error: null })
    queueQueries({
      tutor_conversations: [conversationSelect, conversationUpdate],
      tutor_messages: [messagesSelect],
    })
    summarizeConversationWindowMock.mockResolvedValue('续写摘要')

    await maybeUpdateTutorConversationSummary('conv-1', 'user-1')

    // 从锚点之后开始读
    expect(messagesSelect.calls.gt?.[0]).toEqual(['id', 6])
    expect(conversationUpdate.calls.update?.[0]?.[0]).toEqual({
      summary: '续写摘要',
      summary_message_id: 10,
    })
    // 乐观并发：锚点仍是读取时的 6 才写入
    expect(conversationUpdate.calls.eq).toContainEqual(['summary_message_id', 6])
  })

  it('摘要结果为空时不写入', async () => {
    const conversationSelect = createQuery({ data: { summary: '', summary_message_id: null } })
    const messagesSelect = createQuery({ data: buildMessages(18), error: null })
    queueQueries({
      tutor_conversations: [conversationSelect],
      tutor_messages: [messagesSelect],
    })
    summarizeConversationWindowMock.mockResolvedValue('')

    await maybeUpdateTutorConversationSummary('conv-1', 'user-1')

    // 没有第二次 tutor_conversations 查询（update），说明放弃写入
    expect(fromMock.mock.calls.filter(([table]) => table === 'tutor_conversations')).toHaveLength(1)
  })
})

describe('maybeUpdateTutorNotebook', () => {
  it('按学生累计消息量放宽摘要上限', async () => {
    const notebookSelect = createQuery({ data: { content: '旧笔记', last_message_id: 100 } })
    const newMessages = buildMessages(12).map((m) => ({ ...m, id: m.id + 100 }))
    const messagesSelect = createQuery({ data: newMessages, error: null })
    const messagesCount = createQuery({ count: 350 })
    const notebookUpdate = createQuery({ error: null })
    queueQueries({
      tutor_notebooks: [notebookSelect, notebookUpdate],
      tutor_messages: [messagesSelect, messagesCount],
    })
    summarizeNotebookMock.mockResolvedValue('新笔记')

    await maybeUpdateTutorNotebook('user-1')

    expect(summarizeNotebookMock).toHaveBeenCalledOnce()
    // 350 条消息 → 900 字上限
    expect(summarizeNotebookMock.mock.calls[0][2]).toBe(900)
    expect(notebookUpdate.calls.update?.[0]?.[0]).toMatchObject({
      content: '新笔记',
      last_message_id: 112,
    })
    // 乐观并发：last_message_id 仍是读取时的 100 才写入
    expect(notebookUpdate.calls.eq).toContainEqual(['last_message_id', 100])
  })

  it('新消息不足阈值时不摘要也不数总量', async () => {
    const notebookSelect = createQuery({ data: { content: '旧笔记', last_message_id: 100 } })
    const messagesSelect = createQuery({ data: buildMessages(3), error: null })
    queueQueries({
      tutor_notebooks: [notebookSelect],
      tutor_messages: [messagesSelect],
    })

    await maybeUpdateTutorNotebook('user-1')

    expect(summarizeNotebookMock).not.toHaveBeenCalled()
    // 只有一次 tutor_messages 查询（新消息），没有 count 查询
    expect(fromMock.mock.calls.filter(([table]) => table === 'tutor_messages')).toHaveLength(1)
  })
})
