/** Original score, composed for the reading scene. No sampled or external audio. */
export const BOOK_MUSIC_BPM = 88
export const BOOK_MUSIC_BEATS_PER_BAR = 4
export const BOOK_MUSIC_BAR_SECONDS = BOOK_MUSIC_BEATS_PER_BAR * 60 / BOOK_MUSIC_BPM
export const BOOK_MUSIC_SECTIONS = ["A", "B", "A′", "B′"] as const

export type BookMusicPart = "melody" | "accompaniment" | "bass"
export type BookMusicNote = Readonly<{ part: BookMusicPart; midi: number; beat: number; beats: number; velocity: number }>
export type BookMusicVoice = { source: OscillatorNode; nodes: AudioNode[]; end: number }

// G major, 4/4. Zero is a rest; each pair is [MIDI pitch, beats]. The rests and
// shorter articulations leave room for reading and for the paper/leaf effects.
// A: an upward opening and a descending answer, with an eight-bar cadence.
// B: a higher, more flowing answer. The reprises change rhythm and the endings.
const melody: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[67, 1], [71, 0.5], [74, 0.5], [71, 1], [69, 0.5], [0, 0.5]],
  [[67, 1.5], [64, 0.5], [67, 1], [71, 0.5], [0, 0.5]],
  [[72, 1], [71, 0.5], [69, 0.5], [67, 1], [64, 0.5], [0, 0.5]],
  [[69, 1.5], [66, 0.5], [62, 1], [0, 1]],
  [[67, 0.5], [69, 0.5], [71, 1], [74, 1.5], [0, 0.5]],
  [[76, 1], [74, 0.5], [71, 0.5], [67, 1.5], [0, 0.5]],
  [[69, 0.5], [72, 0.5], [71, 1], [69, 1], [66, 0.5], [0, 0.5]],
  [[67, 2.5], [0, 1.5]],

  [[0, 0.5], [76, 0.5], [74, 1], [71, 0.5], [74, 0.5], [76, 1]],
  [[74, 1.5], [71, 0.5], [69, 1], [67, 0.5], [0, 0.5]],
  [[72, 0.5], [76, 0.5], [74, 1], [72, 1.5], [0, 0.5]],
  [[71, 1], [69, 0.5], [67, 0.5], [69, 1.5], [0, 0.5]],
  [[0, 0.5], [72, 0.5], [74, 1], [76, 0.5], [74, 0.5], [72, 1]],
  [[71, 1.5], [67, 0.5], [64, 1.5], [0, 0.5]],
  [[69, 1], [72, 0.5], [71, 0.5], [69, 1], [66, 1]],
  [[67, 2], [71, 0.5], [69, 0.5], [0, 1]],

  [[67, 1], [71, 0.5], [74, 0.5], [76, 0.5], [74, 0.5], [71, 0.5], [0, 0.5]],
  [[67, 1], [64, 0.5], [67, 0.5], [71, 1.5], [0, 0.5]],
  [[72, 1.5], [71, 0.5], [69, 0.5], [67, 0.5], [64, 0.5], [0, 0.5]],
  [[69, 1], [66, 0.5], [69, 0.5], [62, 1], [0, 1]],
  [[67, 0.5], [69, 0.5], [71, 1.5], [74, 0.5], [71, 0.5], [0, 0.5]],
  [[76, 0.5], [74, 0.5], [71, 1], [67, 1], [64, 0.5], [0, 0.5]],
  [[69, 1], [72, 0.5], [71, 0.5], [66, 1.5], [0, 0.5]],
  [[67, 2], [69, 0.5], [71, 0.5], [0, 1]],

  [[0, 0.5], [76, 0.5], [74, 1.5], [71, 0.5], [76, 1]],
  [[74, 1], [71, 0.5], [69, 0.5], [67, 1.5], [0, 0.5]],
  [[72, 0.5], [76, 0.5], [74, 0.5], [72, 0.5], [69, 1.5], [0, 0.5]],
  [[71, 1.5], [69, 0.5], [67, 1], [0, 1]],
  [[72, 1], [74, 0.5], [76, 0.5], [74, 1], [72, 0.5], [0, 0.5]],
  [[71, 1], [67, 0.5], [64, 0.5], [67, 1.5], [0, 0.5]],
  [[69, 1.5], [72, 0.5], [71, 1], [69, 0.5], [0, 0.5]],
  [[69, 1.5], [67, 0.5], [66, 2]],
]

const chords = {
  G: { bass: 43, fifth: 50, upper: [55, 59, 62] },
  Em: { bass: 40, fifth: 47, upper: [55, 59, 64] },
  C: { bass: 48, fifth: 43, upper: [55, 60, 64] },
  D: { bass: 50, fifth: 45, upper: [54, 57, 62] },
  Am: { bass: 45, fifth: 52, upper: [57, 60, 64] },
} as const
const harmony: ReadonlyArray<keyof typeof chords> = [
  "G", "Em", "C", "D", "G", "Em", "Am", "G",
  "Em", "G", "C", "D", "Am", "Em", "D", "G",
  "G", "Em", "C", "D", "G", "Em", "D", "G",
  "Em", "G", "C", "G", "Am", "Em", "C", "D",
]

export const BOOK_MUSIC_BARS = melody.length
export const BOOK_MUSIC_LOOP_SECONDS = BOOK_MUSIC_BARS * BOOK_MUSIC_BAR_SECONDS

const score: ReadonlyArray<ReadonlyArray<BookMusicNote>> = melody.map((line, bar) => {
  const notes: BookMusicNote[] = []
  let beat = 0
  for (const [midi, beats] of line) {
    if (midi) notes.push({ part: "melody", midi, beat, beats: beats * 0.86, velocity: beat % 1 === 0 ? 1 : 0.82 })
    beat += beats
  }
  const chord = chords[harmony[bar]]
  const answering = Math.floor(bar / 8) % 2 === 1
  // The accompaniment changes its picking direction under the B phrases.
  for (const [i, degree] of (answering ? [2, 1, 0, 1] : [0, 2, 1, 2]).entries()) {
    notes.push({ part: "accompaniment", midi: chord.upper[degree], beat: i + 0.5, beats: 0.42, velocity: i % 2 === 0 ? 0.9 : 0.7 })
  }
  notes.push({ part: "bass", midi: chord.bass, beat: 0, beats: 1.4, velocity: 1 })
  notes.push({ part: "bass", midi: chord.fifth, beat: 2.25, beats: 0.9, velocity: 0.7 })
  return notes.sort((a, b) => a.beat - b.beat)
})

/** A single bar of score data; reading it creates no audio nodes. */
export function bookMusicBar(bar: number): ReadonlyArray<BookMusicNote> {
  return score[((bar % BOOK_MUSIC_BARS) + BOOK_MUSIC_BARS) % BOOK_MUSIC_BARS]
}

/** One oscillator per voice; gentle overtones give the melody a muted wood tone. */
export function createBookMusicSynth(context: BaseAudioContext) {
  const wood = context.createPeriodicWave(new Float32Array(5), new Float32Array([0, 1, 0.2, 0.07, 0.025]))
  return (note: BookMusicNote, barStart: number): BookMusicVoice => {
    const source = context.createOscillator(), gain = context.createGain()
    const start = barStart + note.beat * 60 / BOOK_MUSIC_BPM
    const end = start + note.beats * 60 / BOOK_MUSIC_BPM
    const attack = note.part === "bass" ? 0.035 : 0.018
    const level = { melody: 0.032, accompaniment: 0.012, bass: 0.024 }[note.part] * note.velocity
    if (note.part === "melody") source.setPeriodicWave(wood)
    else source.type = note.part === "bass" ? "sine" : "triangle"
    source.frequency.value = 440 * 2 ** ((note.midi - 69) / 12)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(level, start + attack)
    gain.gain.exponentialRampToValueAtTime(level * 0.38, start + attack + 0.09)
    gain.gain.exponentialRampToValueAtTime(0.0001, end - 0.025)
    gain.gain.linearRampToValueAtTime(0, end)
    source.connect(gain).connect(context.destination)
    source.start(start)
    source.stop(end)
    return { source, nodes: [source, gain], end }
  }
}
