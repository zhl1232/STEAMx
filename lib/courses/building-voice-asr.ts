import { parseBuildingVoiceCommand, type BuildingVoiceCommand } from '@/lib/courses/building-voice-commands'

export type BuildingAsrObservation = {
  text: string
  words: Array<{ word: string; start: number; end: number }>
  valid: boolean
  speechStart: number
  speechEnd: number
  duration: number
}

/** Whole utterance only. Unknown/negative tokens stay intact; timing is a veto, not semantic understanding. */
export function selectBuildingAsrCommand(observation: BuildingAsrObservation): BuildingVoiceCommand | null {
  const { text, words, valid, speechStart, speechEnd, duration } = observation
  if (!valid || typeof text !== 'string' || !Array.isArray(words) || !words.length || words.length > 16 ||
    ![speechStart, speechEnd, duration].every(Number.isFinite) || duration > 6 || speechStart < 0 ||
    speechEnd <= speechStart || speechEnd > duration) return null
  const command = parseBuildingVoiceCommand(text)
  if (!command) return null
  if (words.some((word, i) => typeof word.word !== 'string' || !Number.isFinite(word.start) || !Number.isFinite(word.end) ||
    word.start < 0 || word.end < word.start || word.end > duration + 0.1 || (i > 0 && word.start < words[i - 1].end - 0.03))) return null
  if (words.map((word) => word.word).join('') !== text.replace(/\s/gu, '')) return null
  // Do not accept an ASR command when it leaves audible prefix/suffix speech unexplained.
  // Word alignment is approximate; these are the existing bounded acoustic margins.
  if (words[0].start < speechStart - 0.32 || words[0].start > speechStart + 0.24 ||
    words[words.length - 1].end < speechEnd - 0.24) return null
  return command
}
