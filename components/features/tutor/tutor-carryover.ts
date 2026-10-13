import type { TutorChatMessage } from './use-tutor-chat-stream'
import type { TutorSendInput } from '@/lib/schemas'

export const MAX_CARRY_DISPLAY = 20
export type TutorPreviousContext = NonNullable<TutorSendInput['previousContext']>
/** @deprecated Dividers were browse-trail markers; kept only so old in-memory payloads type-check. Never create or render them. */
export type TutorDisplayMessage = TutorChatMessage | { role: 'divider'; content: string }

function isChatMessage(message: TutorDisplayMessage): message is TutorChatMessage {
  return message.role !== 'divider'
}

/** Keep the latest completed chat bubbles for cross-page continuity. Trail dividers are dropped. */
export function carryTutorMessages(messages: readonly TutorDisplayMessage[]): TutorDisplayMessage[] {
  const completed = messages.filter((message): message is TutorChatMessage => isChatMessage(message) && !message.streaming)
  return completed.length ? completed.slice(-MAX_CARRY_DISPLAY) : []
}

/**
 * Merge carried bubbles into the current scene list.
 * `title` is unused (kept for call-site compatibility); we no longer inject
 * visible「现在在：…」trail markers — previousContext still goes to the model separately.
 */
export function tutorDisplayMessages(
  carried: readonly TutorDisplayMessage[],
  messages: TutorChatMessage[],
  _title?: string,
  localRequestIds?: ReadonlySet<string>,
): TutorDisplayMessage[] {
  if (!carried.length) return messages
  const cleanCarried = carried.filter(isChatMessage)
  const seen = new Set(cleanCarried.map((message) => JSON.stringify([message.role, message.content])))
  return [
    ...cleanCarried,
    // De-duplicate loaded history, never hide a newly sent question or reply.
    ...messages.filter((message) => (message.requestId && localRequestIds?.has(message.requestId))
      || !seen.has(JSON.stringify([message.role, message.content]))),
  ]
}
