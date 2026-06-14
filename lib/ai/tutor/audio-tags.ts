import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

/** 小迪回复中的鸟鸣引用标记：[audio:/birds/audio/foo.ogg|物种名] */
export const AUDIO_TAG_REGEX = /\[audio:([^|\]\n]+)\|([^\]\n]+)\]/g

export type TutorAudioRef = {
  slug: string
  label: string
  audioUrl: string
}

const BIRD_CALL_QUERY_REGEX = /叫声|鸣叫|怎么叫|叫什么|听听|试听|声音|鸣声|鸣唱|鸟鸣|录音|song|call/i

export function buildAudioTag(audioUrl: string, label: string) {
  return `[audio:${audioUrl.trim()}|${label.trim()}]`
}

export function isBirdCallQuery(text: string) {
  return BIRD_CALL_QUERY_REGEX.test(text)
}

export function replyHasAudioTag(text: string) {
  return AUDIO_TAG_REGEX.test(text)
}

export function findMatchingAudio(
  userMessage: string,
  reply: string,
  audios: TutorAudioRef[],
): TutorAudioRef | null {
  if (!audios.length) return null

  const haystack = `${userMessage}\n${reply}`
  const matched = audios.filter((audio) => haystack.includes(audio.label))
  if (matched.length === 1) return matched[0]
  if (matched.length > 1) {
    return matched.find((audio) => userMessage.includes(audio.label)) ?? matched[0]
  }

  if (audios.length === 1 && isBirdCallQuery(haystack)) return audios[0]
  return null
}

export function enrichReplyWithAudio(
  reply: string,
  userMessage: string,
  audios: TutorAudioRef[],
): string {
  const trimmed = reply.trim()
  if (!trimmed || !audios.length || replyHasAudioTag(trimmed)) return reply

  const combined = `${userMessage}\n${trimmed}`
  if (!isBirdCallQuery(combined)) return reply

  const matched = findMatchingAudio(userMessage, trimmed, audios)
  if (!matched) return reply

  return `${trimmed}\n\n${buildAudioTag(matched.audioUrl, matched.label)}`
}

/** 去掉模型可能误写的音频标记，再由服务端按数据库 audio_url 重新插入。 */
export function finalizeReplyAudio(
  reply: string,
  userMessage: string,
  audios: TutorAudioRef[],
): string {
  const stripped = reply
    .replace(AUDIO_TAG_REGEX, '')
    .replace(/[（(]?\s*系统已自动附上[^)\n）]*[)）]?/g, '')
    .replace(/[（(]?\s*播放器由系统自动附上[^)\n）]*[)）]?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return enrichReplyWithAudio(stripped, userMessage, audios)
}

export function buildAvailableAudiosSummary(audios: TutorAudioRef[]) {
  if (!audios.length) return ''

  const names = audios.map((audio) => audio.label).join('、')
  return [
    '【本站有鸟鸣录音的物种】',
    `${names}。聊到叫声时简短说明即可；有录音时播放器会自动出现，不要提示用户去点听，也不要说「系统已附上」。`,
  ].join('\n')
}

export function mapSpeciesRowToAudioRef(row: {
  slug: string
  common_name: string
  audio_url: string | null
}): TutorAudioRef | null {
  if (!row.audio_url?.trim()) return null
  return {
    slug: row.slug,
    label: row.common_name,
    audioUrl: row.audio_url.trim(),
  }
}

function matchSpeciesAudiosInText(
  rows: Array<{
    slug: string
    common_name: string
    aliases: string[] | null
    audio_url: string | null
  }>,
  text: string,
): TutorAudioRef[] {
  return rows
    .map((row) => {
      const names = [row.common_name, ...(Array.isArray(row.aliases) ? row.aliases : [])]
        .map((name) => (typeof name === 'string' ? name.trim() : ''))
        .filter(Boolean)
      const mentioned = names.some((name) => text.includes(name))
      if (!mentioned) return null
      return mapSpeciesRowToAudioRef(row)
    })
    .filter((item): item is TutorAudioRef => item !== null)
}

export async function findSpeciesAudiosMentionedInText(
  supabase: SupabaseClient<Database>,
  text: string,
): Promise<TutorAudioRef[]> {
  const trimmed = text.trim()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from('species')
    .select('slug, common_name, aliases, audio_url')
    .eq('nature_topic', 'birds')
    .eq('is_active', true)
    .not('audio_url', 'is', null)
    .limit(200)

  if (error || !data?.length) return []
  return matchSpeciesAudiosInText(data, trimmed)
}

export async function findSpeciesAudiosForMessage(
  supabase: SupabaseClient<Database>,
  message: string,
): Promise<TutorAudioRef[]> {
  if (!isBirdCallQuery(message)) return []
  return findSpeciesAudiosMentionedInText(supabase, message)
}
