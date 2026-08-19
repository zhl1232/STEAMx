import { describe, expect, it } from 'vitest'

import {
  decodeBase64ToArrayBuffer,
  decodePcm16ToFloat32,
} from '@/components/features/tutor/tutor-pcm-player'
import {
  buildTutorLongPressHintState,
  encodePcm16,
  getTutorVoicePreferences,
  isTutorAutoReadEnabled,
  mergeTutorVoiceTranscript,
  resampleAudio,
  shouldShowTutorLongPressHint,
  TUTOR_AUTO_READ_STORAGE_KEY,
  TUTOR_LONG_PRESS_HINT_COOLDOWN_MS,
  TUTOR_MOBILE_LONG_PRESS_STORAGE_KEY,
  TUTOR_VOICE_HINT_STORAGE_KEY,
  TUTOR_VOICE_REPLY_STORAGE_KEY,
  TUTOR_VOICE_SAMPLE_RATE,
} from '@/components/features/tutor/tutor-voice'

describe('mergeTutorVoiceTranscript', () => {
  it('fills an empty composer with the transcript', () => {
    expect(mergeTutorVoiceTranscript('', ' 帮我看看这一步 ')).toBe('帮我看看这一步')
  })

  it('appends to existing composer text on a new line', () => {
    expect(mergeTutorVoiceTranscript('我先做了桥面  ', '下一步怎么加固？')).toBe('我先做了桥面\n下一步怎么加固？')
  })
})

describe('PCM helpers', () => {
  it('encodes float samples as signed 16-bit PCM', () => {
    expect(Array.from(encodePcm16(new Float32Array([-1, 0, 1])))).toEqual([-32768, 0, 32767])
  })

  it('resamples audio to the tutor speech sample rate', () => {
    const input = new Float32Array(TUTOR_VOICE_SAMPLE_RATE * 2).fill(0.5)
    const output = resampleAudio(input, TUTOR_VOICE_SAMPLE_RATE * 2, TUTOR_VOICE_SAMPLE_RATE)

    expect(output).toHaveLength(TUTOR_VOICE_SAMPLE_RATE)
    expect(output[0]).toBeCloseTo(0.5)
  })

  it('round-trips PCM16 through float conversion', () => {
    const encoded = encodePcm16(new Float32Array([-1, 0, 1]))
    const decoded = decodePcm16ToFloat32(encoded.buffer)
    expect(decoded[0]).toBeCloseTo(-1)
    expect(decoded[1]).toBeCloseTo(0)
    expect(decoded[2]).toBeCloseTo(1)
  })

  it('decodes base64 PCM frames used by the tutor SSE', () => {
    const pcm = Uint8Array.from([1, 2, 3, 4])
    const encoded = btoa(String.fromCharCode(...pcm))
    expect(Array.from(new Uint8Array(decodeBase64ToArrayBuffer(encoded)))).toEqual(Array.from(pcm))
  })
})

describe('isTutorAutoReadEnabled', () => {
  it('defaults auto-read to enabled for new users', () => {
    expect(isTutorAutoReadEnabled(null)).toBe(true)
  })

  it('keeps auto-read disabled after the user turns off the global switch', () => {
    expect(isTutorAutoReadEnabled('0')).toBe(false)
  })
})

describe('getTutorVoicePreferences', () => {
  it('defaults all voice preferences to enabled', () => {
    expect(getTutorVoicePreferences(null)).toEqual({
      autoReadReplies: true,
      mobileLongPressInput: true,
      voiceInputAutoPlay: true,
      showLongPressHint: true,
    })
  })

  it('reads stored voice preferences from local storage keys', () => {
    const values: Record<string, string> = {
      [TUTOR_AUTO_READ_STORAGE_KEY]: '0',
      [TUTOR_MOBILE_LONG_PRESS_STORAGE_KEY]: '1',
      [TUTOR_VOICE_REPLY_STORAGE_KEY]: '0',
      [TUTOR_VOICE_HINT_STORAGE_KEY]: '0',
    }

    expect(
      getTutorVoicePreferences({
        getItem: (key) => values[key] ?? null,
      }),
    ).toEqual({
      autoReadReplies: false,
      mobileLongPressInput: true,
      voiceInputAutoPlay: false,
      showLongPressHint: false,
    })
  })
})

describe('long-press voice hint throttling', () => {
  it('shows the hint before it has ever been shown', () => {
    expect(shouldShowTutorLongPressHint(null, 1_000)).toBe(true)
  })

  it('hides the hint until the cooldown has passed', () => {
    const stored = buildTutorLongPressHintState(null, 1_000)

    expect(shouldShowTutorLongPressHint(stored, 1_000 + TUTOR_LONG_PRESS_HINT_COOLDOWN_MS - 1)).toBe(false)
    expect(shouldShowTutorLongPressHint(stored, 1_000 + TUTOR_LONG_PRESS_HINT_COOLDOWN_MS)).toBe(true)
  })
})
