import { supabaseAdmin } from '@/lib/supabase/admin'
import { TutorSpeechError } from './speech-error'

/** Shared by all users, endpoints and application instances. Fail closed if migration is missing. */
export async function reserveSpeechRequest(kind: 'tts' | 'asr') {
  if (!supabaseAdmin) throw new TutorSpeechError('Missing speech budget database', undefined, 503)
  const { data, error } = await supabaseAdmin.rpc('reserve_tutor_speech_request' as never, { p_kind: kind } as never)
  if (error) throw new TutorSpeechError('Speech budget unavailable', undefined, 503)
  if (data !== true) throw new TutorSpeechError('Speech provider budget exhausted', '语音请求较多，请稍后再试。', 429)
}
