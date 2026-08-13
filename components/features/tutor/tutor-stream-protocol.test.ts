import { describe, expect, it } from 'vitest'

import { readTutorStreamEvents, type TutorStreamEvent } from './tutor-stream-protocol'

function streamFromChunks(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      }
      controller.close()
    },
  })
}

async function collect(chunks: Array<string | Uint8Array>) {
  const events: TutorStreamEvent[] = []
  for await (const event of readTutorStreamEvents(streamFromChunks(chunks))) {
    events.push(event)
  }
  return events
}

describe('readTutorStreamEvents', () => {
  it('解析完整的 data 行为事件', async () => {
    const events = await collect([
      'data: {"type":"chunk","content":"你"}\n\ndata: {"type":"done","reply":"你好"}\n\n',
    ])

    expect(events).toEqual([
      { type: 'chunk', content: '你' },
      { type: 'done', reply: '你好' },
    ])
  })

  it('拼接跨 chunk 边界拆开的事件', async () => {
    const events = await collect(['data: {"type":"chunk","con', 'tent":"好"}\n'])

    expect(events).toEqual([{ type: 'chunk', content: '好' }])
  })

  it('处理多字节字符在字节层被拆开的情况', async () => {
    const bytes = new TextEncoder().encode('data: {"type":"chunk","content":"小迪"}\n')
    // 「小」的 3 个 UTF-8 字节会落在切点两侧
    const splitAt = bytes.length - 8
    const events = await collect([bytes.slice(0, splitAt), bytes.slice(splitAt)])

    expect(events).toEqual([{ type: 'chunk', content: '小迪' }])
  })

  it('跳过非 data 行、空 payload 与坏 JSON', async () => {
    const events = await collect([
      ': keepalive\n',
      'event: message\n',
      'data:\n',
      'data: not-json\n',
      'data: {"type":"warning","warning":"退回文字模式"}\n',
    ])

    expect(events).toEqual([{ type: 'warning', warning: '退回文字模式' }])
  })

  it('透传 tool_call 事件的 toolCall 负载', async () => {
    const events = await collect([
      'data: {"type":"tool_call","toolCall":{"name":"highlight_blocks","args":{"category":"motion"}}}\n',
    ])

    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('tool_call')
    expect(events[0]?.toolCall).toMatchObject({ name: 'highlight_blocks' })
  })

  it('透传 audio / audio_done 事件的 PCM 负载', async () => {
    const events = await collect([
      'data: {"type":"audio","pcm":"AQIDBA==","sampleRate":24000}\n\ndata: {"type":"audio_done"}\n\n',
    ])

    expect(events).toEqual([
      { type: 'audio', pcm: 'AQIDBA==', sampleRate: 24000 },
      { type: 'audio_done' },
    ])
  })

  it('丢弃流结束时没有换行收尾的残缺行（与服务端 \\n\\n 结尾约定一致）', async () => {
    const events = await collect(['data: {"type":"chunk","content":"a"}\ndata: {"type":"done"'])

    expect(events).toEqual([{ type: 'chunk', content: 'a' }])
  })
})
