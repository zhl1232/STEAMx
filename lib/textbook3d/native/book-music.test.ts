import { describe, expect, it } from "vitest"
import { BOOK_MUSIC_BARS, BOOK_MUSIC_BEATS_PER_BAR, BOOK_MUSIC_LOOP_SECONDS, bookMusicBar } from "./book-music"

const bars = Array.from({ length: BOOK_MUSIC_BARS }, (_, bar) => bookMusicBar(bar))
const melody = bars.map(bar => bar.filter(note => note.part === "melody"))

describe("original reading music", () => {
  it("has a full 32-bar, 80–100 second form instead of a short repeating chime", () => {
    expect(BOOK_MUSIC_BARS).toBe(32)
    expect(BOOK_MUSIC_LOOP_SECONDS).toBeGreaterThan(80)
    expect(BOOK_MUSIC_LOOP_SECONDS).toBeLessThan(100)
    expect(new Set(melody.map(bar => JSON.stringify(bar))).size).toBeGreaterThan(24)
    expect(new Set(melody.flat().map(note => note.midi)).size).toBeGreaterThanOrEqual(9)
    expect(new Set(melody.flat().map(note => note.beats)).size).toBeGreaterThanOrEqual(4)
  })

  it("gives A and B different rhythm, contour and accompaniment, then varies both reprises", () => {
    const opening = (section: number) => melody.slice(section * 8, section * 8 + 2).flat()
    const pitches = (section: number) => opening(section).map(note => note.midi)
    const rhythm = (section: number) => opening(section).map(note => [note.beat, note.beats])
    expect(pitches(0)).not.toEqual(pitches(1))
    expect(rhythm(0)).not.toEqual(rhythm(1))
    expect(Math.max(...pitches(1))).toBeGreaterThan(Math.max(...pitches(0)))
    expect(pitches(2).slice(0, 3)).toEqual(pitches(0).slice(0, 3))
    expect(pitches(2)).not.toEqual(pitches(0))
    expect(rhythm(3)).not.toEqual(rhythm(1))
    const picking = (bar: number) => bars[bar].filter(note => note.part === "accompaniment").map(note => note.midi)
    expect(picking(0)[0]).toBeLessThan(picking(0)[1])
    expect(picking(8)[0]).toBeGreaterThan(picking(8)[1])
  })

  it("keeps three quiet, separated parts with breaths and at most three simultaneous notes", () => {
    for (const bar of bars) {
      expect(new Set(bar.map(note => note.part))).toEqual(new Set(["melody", "accompaniment", "bass"]))
      expect(bar.length).toBeLessThanOrEqual(14)
      for (const note of bar) {
        expect(note.beat).toBeGreaterThanOrEqual(0)
        expect(note.beats).toBeGreaterThan(0)
        expect(note.beat + note.beats).toBeLessThan(BOOK_MUSIC_BEATS_PER_BAR)
        expect(note.velocity).toBeGreaterThan(0)
        expect(note.velocity).toBeLessThanOrEqual(1)
      }
      expect(Math.max(...bar.filter(note => note.part === "bass").map(note => note.midi)))
        .toBeLessThan(Math.min(...bar.filter(note => note.part === "melody").map(note => note.midi)))
      const events = bar.flatMap(note => [{ beat: note.beat, delta: 1 }, { beat: note.beat + note.beats, delta: -1 }])
        .sort((a, b) => a.beat - b.beat || a.delta - b.delta)
      let sounding = 0
      for (const event of events) {
        sounding += event.delta
        expect(sounding).toBeLessThanOrEqual(3)
      }
      expect(sounding).toBe(0)
    }
  })

  it("resolves the final leading tone into the opening and loops without adding a silent bar", () => {
    const ending = melody.at(-1)!.at(-1)!, opening = melody[0][0]
    expect(opening.midi - ending.midi).toBe(1)
    expect(BOOK_MUSIC_BEATS_PER_BAR - ending.beat - ending.beats + opening.beat).toBeLessThan(0.5)
    expect(bookMusicBar(32)).toEqual(bookMusicBar(0))
    expect(bookMusicBar(65)).toEqual(bookMusicBar(1))
  })
})
