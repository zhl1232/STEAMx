import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import type { TutorResourceClarification } from '@/lib/ai/tutor/resource-clarification'

/** 服务端 /api/tutor/chat SSE 事件（data: 行内的 JSON） */
export type TutorStreamEvent = {
  type?: string
  content?: string
  reply?: string
  error?: string
  warning?: string
  pcm?: string
  sampleRate?: number
  toolCall?: TutorToolCall
  clarification?: TutorResourceClarification
  phase?: string
  timings?: Array<{ name: string; elapsedMs: number; deltaMs: number }>
}

/**
 * 把 SSE 字节流逐行解析为事件：只认 `data:` 行，空 payload 与坏 JSON 跳过。
 * 解析与消费解耦，方便对协议层单独回归。
 */
export async function* readTutorStreamEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<TutorStreamEvent, void, undefined> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const json = trimmed.slice(5).trim()
      if (!json) continue
      let event: TutorStreamEvent
      try {
        event = JSON.parse(json)
      } catch {
        continue
      }
      yield event
    }
  }
}
