export type BuildingVoiceCommand = 'next' | 'previous' | 'pause' | 'exit'

/** Complete wake-name + action phrases only. These are pinyin tokens, not ASR text. */
export const BUILDING_KWS_KEYWORDS = [
  'x iǎo d í x ià y ī b ù @next',
  'x iǎo d í x ià y ī y è @next_page',
  'x iǎo d í sh àng y ī b ù @previous',
  'x iǎo d í sh àng y ī y è @previous_page',
  'x iǎo d í z àn t íng @pause',
  'x iǎo d í t uì ch ū @exit',
  // A separate rejection stream prevents a longer command from masking these hits.
].join('\n')

export const BUILDING_KWS_WAKE = 'x iǎo d í @wake'
export const BUILDING_KWS_ACTIONS = BUILDING_KWS_KEYWORDS.split('\n').map((line) => line.split(' ').slice(4).join(' ')).join('\n')

export const BUILDING_KWS_REJECTIONS = [
  'b ù y ào @reject', 'b ú y ào @reject', 'b ù x ià @reject', 'b ié @reject', 'm éi @reject',
  'sh uō @reject', 'j iào @reject', 'k ǒu l ìng @reject',
  'm a @reject', 'm e @reject', 'n e @reject',
].join('\n')

export type BuildingKwsHit = { keyword: string; timestamps: number[]; tokens: string[]; start_time: number }
export type BuildingKwsObservation = {
  hits: BuildingKwsHit[]
  rejected: boolean
  speechStart: number
  speechEnd: number
  duration: number
}

/** Acoustic safeguards, NOT the whole-transcript parser below. Fail closed on ambiguity. */
export function selectBuildingKwsCommand(observation: BuildingKwsObservation): BuildingVoiceCommand | null {
  const { hits, rejected, speechStart, speechEnd, duration } = observation
  if (rejected || hits.length !== 2 || ![speechStart, speechEnd, duration].every(Number.isFinite) ||
    duration > 5 || speechStart < 0 || speechEnd <= speechStart || speechEnd > duration || speechEnd - speechStart > 3.5) return null
  const [wake, hit] = hits
  if (wake.keyword !== 'wake') return null
  const command: BuildingVoiceCommand | null = hit.keyword === 'next_page' ? 'next' : hit.keyword === 'previous_page' ? 'previous' :
    ['next', 'previous', 'pause', 'exit'].includes(hit.keyword) ? hit.keyword as BuildingVoiceCommand : null
  if (!command) return null
  for (const part of hits) {
    if (!Number.isFinite(part.start_time) || part.timestamps.length < 4 || part.timestamps.length !== part.tokens.length ||
      part.timestamps.some((value, index) => !Number.isFinite(value) || value < 0 || (index > 0 && value < part.timestamps[index - 1]))) return null
  }
  const first = wake.start_time + wake.timestamps[0]
  const wakeEnd = wake.start_time + wake.timestamps[wake.timestamps.length - 1]
  const actionStart = hit.start_time + hit.timestamps[0]
  const last = hit.start_time + hit.timestamps[hit.timestamps.length - 1]
  // One complete wake name followed by one action in a bounded wake window.
  // The first consonant can align to pre-roll at t=0; also bound the first vowel
  // so a spurious t=0 consonant cannot conceal an actual late wake name.
  // Independent competing-action detection must also have passed in the worker.
  if (actionStart < wakeEnd || actionStart - wakeEnd > 0.8 || first - speechStart > 0.24 ||
    first < speechStart - 0.32 || wake.start_time + wake.timestamps[1] > speechStart + 0.4 || speechEnd - last > 0.3 || last > speechEnd + 0.16 ||
    last - first < 0.45 || last - first > 3.2) return null
  return command
}

const COMMANDS: Readonly<Record<string, BuildingVoiceCommand>> = {
  下一步: 'next',
  下一页: 'next',
  上一步: 'previous',
  上一页: 'previous',
  暂停: 'pause',
  退出: 'exit',
}

/** Only complete, explicit navigation instructions are executable. No model or fuzzy matching. */
export function parseBuildingVoiceCommand(transcript: string): BuildingVoiceCommand | null {
  if (transcript.length > 80 || /[?？]/u.test(transcript)) return null

  // Keep quotes, negation, question particles and all other words intact so they
  // cannot turn a question or a discussion about a command into an instruction.
  const normalized = transcript.normalize('NFKC').replace(/[\s，,。.!！、：:；;]/gu, '')
  const match = /^小迪(?:请你|请|麻烦你)?(下一步|下一页|上一步|上一页|暂停|退出)(?:谢谢)?$/u.exec(normalized)
  return match ? COMMANDS[match[1]] ?? null : null
}
