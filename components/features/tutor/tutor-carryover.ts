import type { TutorChatMessage } from './use-tutor-chat-stream'
import type { TutorSendInput } from '@/lib/schemas'

export const MAX_CARRY_DISPLAY = 20
export type TutorPreviousContext = NonNullable<TutorSendInput['previousContext']>
export type TutorDisplayMessage = TutorChatMessage | { role: 'divider'; content: string }

export function carryTutorMessages(messages: readonly TutorDisplayMessage[]): TutorDisplayMessage[] {
  const completed = messages.filter((message) => message.role === 'divider' || !message.streaming)
  return completed.some((message) => message.role !== 'divider') ? completed.slice(-MAX_CARRY_DISPLAY) : []
}

export function tutorDisplayMessages(carried: readonly TutorDisplayMessage[], messages: TutorChatMessage[], title?: string, localRequestIds?: ReadonlySet<string>): TutorDisplayMessage[] {
  if (!carried.length) return messages
  const seen = new Set(carried.filter((message) => message.role !== 'divider').map((message) => JSON.stringify([message.role, message.content])))
  return [...carried, { role: 'divider', content: `现在在：${title || '新页面'}` },
    // De-duplicate loaded history, never hide a newly sent question or reply.
    ...messages.filter((message) => (message.requestId && localRequestIds?.has(message.requestId))
      || !seen.has(JSON.stringify([message.role, message.content])))]
}
