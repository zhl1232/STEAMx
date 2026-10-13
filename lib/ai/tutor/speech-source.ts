import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { TutorSpeechError } from './speech-error'

export const TUTOR_VOICE_PREVIEW_TEXT = '你好，我是小迪。让我们一起观察、动手，发现新的问题，再试一种办法吧。'
export type SpeechSourceInput = {
  text?: string
  messageId?: number
  preview?: boolean
  voice?: string
  fallback?: boolean
}

export function parseSpeechSource(input: unknown): SpeechSourceInput {
  const invalid = () => { throw new TutorSpeechError('Invalid speech source', '朗读请求不正确，请刷新后重试。', 400) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid()
  const value = input as Record<string, unknown>
  if (Object.keys(value).some(key => !['text', 'messageId', 'preview', 'voice', 'fallback'].includes(key))) return invalid()
  if (value.voice !== undefined && (typeof value.voice !== 'string' || !value.voice || value.voice.length > 64)) return invalid()
  if (value.preview !== undefined && typeof value.preview !== 'boolean') return invalid()
  if (value.fallback !== undefined && typeof value.fallback !== 'boolean') return invalid()
  if (value.preview === true) {
    // Preview is a distinct operation: no caller-controlled text or message reference.
    if (typeof value.voice !== 'string' || value.text !== undefined || value.messageId !== undefined) return invalid()
  } else {
    const hasId = value.messageId !== undefined
    const hasText = value.text !== undefined
    if (hasId === hasText) return invalid()
    if (hasId && (!Number.isSafeInteger(value.messageId) || Number(value.messageId) <= 0)) return invalid()
    if (hasText && (typeof value.text !== 'string' || !value.text.trim() || value.text.length > 32_000)) return invalid()
  }
  return value as SpeechSourceInput
}

/** The text compatibility path still requires an exact, owned, saved assistant reply. */
export async function resolveSpeechSource(
  supabase: SupabaseClient<Database>, input: SpeechSourceInput, canChoose: boolean,
): Promise<string> {
  if (input.preview) {
    if (!canChoose) throw new TutorSpeechError('Preview forbidden', '会员可以试听并选择声音。', 403)
    return TUTOR_VOICE_PREVIEW_TEXT
  }
  // RPC uses auth.uid(), not a submitted owner id. POST avoids huge URLs for legacy text references.
  const { data, error } = await supabase.rpc('resolve_tutor_speech_reply' as never, {
    p_message_id: input.messageId ?? null, p_text: input.text ?? null,
  } as never)
  if (error) throw new TutorSpeechError('Speech source lookup unavailable', '暂时无法确认这条回复，请稍后重试。', 503)
  if (typeof data !== 'string' || !data) throw new TutorSpeechError('Speech source not found', '只能朗读当前账号已保存的小迪回复，请刷新后重试。', 404)
  return data
}
