import { supabaseAdmin } from '@/lib/supabase/admin'
import { TutorSpeechError } from './speech-error'

export type SpeechKind = 'tts' | 'asr'

/** Units are admitted characters / whole audio seconds, not customer AI credits. */
export async function withSpeechUsage<T>(
  userId: string, kind: SpeechKind, units: number,
  run: () => Promise<T>, signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new TutorSpeechError('Speech cancelled', '语音已取消。', 499)
  if (!Number.isSafeInteger(units) || units < 1) throw new TutorSpeechError('Invalid speech units', undefined, 400)
  if (!supabaseAdmin) throw new TutorSpeechError('Missing speech usage database', undefined, 503)
  const { data, error } = await supabaseAdmin.rpc('reserve_tutor_speech_usage' as never, {
    p_user_id: userId, p_kind: kind, p_units: units,
  } as never)
  const result = data as { ok?: boolean; leaseId?: string; error?: string } | null
  if (error) throw new TutorSpeechError('Speech usage unavailable', '语音保护服务暂未就绪，请稍后重试。', 503)
  if (!result?.ok) {
    const code = result?.error
    if (!['user_daily_limit', 'global_daily_limit', 'concurrency_limit'].includes(code ?? '')) {
      throw new TutorSpeechError('Invalid speech usage admission', undefined, 503)
    }
    throw new TutorSpeechError('Speech safety limit', code === 'user_daily_limit'
      ? '今天的语音体验用量已达上限，明天可继续；仍可使用文字和翻页按钮。'
      : '语音服务较繁忙，请稍后再试；仍可使用文字和翻页按钮。', 429)
  }
  if (!result.leaseId || !/^[0-9a-f-]{36}$/i.test(result.leaseId)) {
    throw new TutorSpeechError('Invalid speech lease', undefined, 503)
  }
  try {
    if (signal?.aborted) throw new TutorSpeechError('Speech cancelled', '语音已取消。', 499)
    return await run()
  } finally {
    // Releases concurrency only. No automatic usage refund after an ambiguous failure.
    // A failed cleanup expires after five minutes and never masks the supplier result.
    try {
      const release = await supabaseAdmin.rpc('release_tutor_speech_usage' as never, { p_lease_id: result.leaseId } as never)
      if (release.error) console.warn('speech_lease_release_failed')
    } catch { console.warn('speech_lease_release_failed') }
  }
}
