import { createHash, randomUUID } from 'node:crypto'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Database, Json } from '@/lib/supabase/types'
import type { TutorSendInput } from '@/lib/schemas'
import { TUTOR_MAX_OUTPUT_TOKENS } from './billing'

type Conversation = Database['public']['Tables']['tutor_conversations']['Row']
type Message = Database['public']['Tables']['tutor_messages']['Row']
export type TutorRequestResult =
  | { status: 'started'; conversation: Conversation; receiptId: number; maxOutputTokens: number }
  | { status: 'completed'; conversationId: string; message: Message }
  | { status: 'processing' | 'failed' | 'unavailable' | 'conflict' | 'stale_topic' | 'busy' }
  | { status: 'rejected'; error: string; resetAt?: number }

type Functions = Database['public']['Functions']
type RequestRpc = 'get_tutor_chat_session_service' | 'archive_tutor_chat_service' | 'begin_tutor_request_service'
  | 'complete_tutor_request_service' | 'fail_tutor_request_service' | 'delete_tutor_conversation_service'

async function rpc<T extends RequestRpc>(name: T, args: Functions[T]['Args']) {
  if (!supabaseAdmin) throw new Error('Tutor request service unavailable')
  const { data, error } = await supabaseAdmin.rpc(name, args)
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid tutor request response')
  return data as Record<string, Json>
}

export async function getTutorChatSession(userId: string, contextType: string, contextId: string) {
  return await rpc('get_tutor_chat_session_service', { p_user_id: userId, p_context_type: contextType, p_context_id: contextId }) as {
    epoch: number; conversation: Conversation | null
  }
}

export async function archiveTutorChat(userId: string, contextType: string, contextId: string, epoch: number) {
  return await rpc('archive_tutor_chat_service', { p_user_id: userId, p_context_type: contextType, p_context_id: contextId, p_epoch: epoch })
}

export async function deleteTutorConversation(userId: string, conversationId: string) {
  return await rpc('delete_tutor_conversation_service', { p_user_id: userId, p_conversation_id: conversationId })
}

export async function beginTutorRequest(userId: string, input: TutorSendInput): Promise<TutorRequestResult> {
  // Zod produces a stable field order and strips unknown fields. Include all
  // input that can change the reply, scene, image interpretation or tool actions.
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const args = {
    p_user_id: userId, p_request_id: input.requestId, p_request_hash: hash,
    p_context_type: input.contextType, p_context_id: input.contextId ?? '', p_epoch: input.epoch,
    p_max_output_tokens: TUTOR_MAX_OUTPUT_TOKENS, p_executor_id: randomUUID(),
  }
  return await rpc('begin_tutor_request_service', args)
    .catch(() => rpc('begin_tutor_request_service', args)) as TutorRequestResult
}

export async function completeTutorRequest(userId: string, requestId: string, input: {
  content: string; images: string[]; meta: Record<string, unknown>; reply: string;
  assistantMeta: Record<string, unknown>; outputTokens: number | null; clarification?: boolean; title: string
}): Promise<TutorRequestResult> {
  const args = {
    p_user_id: userId, p_request_id: requestId, p_user_content: input.content,
    p_images: input.images, p_user_meta: input.meta as Json, p_reply: input.reply,
    p_assistant_meta: input.assistantMeta as Json, p_output_tokens: input.outputTokens,
    p_clarification: input.clarification === true, p_title: input.title,
  }
  // Both attempts use the same transaction identity. A lost success response
  // returns the original saved message and settlement, never inserts them again.
  return await rpc('complete_tutor_request_service', args)
    .catch(() => rpc('complete_tutor_request_service', args)) as TutorRequestResult
}

export async function failTutorRequest(userId: string, requestId: string): Promise<TutorRequestResult> {
  const args = { p_user_id: userId, p_request_id: requestId }
  return await rpc('fail_tutor_request_service', args)
    .catch(() => rpc('fail_tutor_request_service', args)) as TutorRequestResult
}
