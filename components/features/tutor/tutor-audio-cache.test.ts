import { afterEach, expect, it, vi } from 'vitest'
import { TutorAudioCache, pcmWav } from './tutor-audio-cache'
afterEach(() => vi.useRealTimers())
it('produces a native WAV from the original PCM bytes', async () => {
  const wav = pcmWav([Uint8Array.from([1, 2, 3, 4]).buffer])
  expect(wav.type).toBe('audio/wav')
  expect(wav.size).toBe(48)
})
it('bounds memory and lifetime, isolates keys and clears on identity or voice changes', () => {
  vi.useFakeTimers()
  const cache = new TutorAudioCache(), blob = new Blob(['audio'])
  cache.put('userA:voiceA:message', blob)
  expect(cache.get('userB:voiceA:message')).toBeNull()
  expect(cache.get('userA:voiceB:message')).toBeNull()
  expect(cache.get('userA:voiceA:message')).toBe(blob)
  vi.advanceTimersByTime(600001)
  expect(cache.get('userA:voiceA:message')).toBeNull()
  for (let index = 0; index < 9; index++) cache.put(String(index), blob)
  expect(cache.get('0')).toBeNull()
  cache.clear(); expect(cache.get('8')).toBeNull()
})
