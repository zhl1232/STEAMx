import { describe, expect, it } from 'vitest'

import {
  buildAudioTag,
  enrichReplyWithAudio,
  finalizeReplyAudio,
  findMatchingAudio,
  isBirdCallQuery,
  replyHasAudioTag,
} from '@/lib/ai/tutor/audio-tags'
import { buildSpeciesPageResourceSummary } from '@/lib/ai/tutor/context-builders'

describe('buildSpeciesPageResourceSummary', () => {
  it('asks the tutor to rely on auto-inserted audio when audio exists', () => {
    const summary = buildSpeciesPageResourceSummary({
      natureTopic: 'birds',
      audioUrl: '/birds/call.mp3',
    })

    expect(summary).toContain('不要提示用户去点听')
    expect(summary).not.toContain('系统自动附上')
  })

  it('marks missing bird audio so the tutor does not pretend it exists', () => {
    const summary = buildSpeciesPageResourceSummary({
      natureTopic: 'birds',
      audioUrl: null,
    })

    expect(summary).toContain('暂无鸟鸣音频')
    expect(summary).toContain('不要假装')
  })
})

describe('audio tag helpers', () => {
  const audios = [
    {
      slug: 'lanius-cristatus',
      label: '红尾伯劳',
      audioUrl: '/birds/audio/lanius-cristatus.ogg',
    },
  ]

  it('detects bird call questions', () => {
    expect(isBirdCallQuery('红尾伯劳的叫声')).toBe(true)
    expect(isBirdCallQuery('它长什么样')).toBe(false)
    expect(isBirdCallQuery('本站正好有录音，可以对比听听')).toBe(true)
  })

  it('builds stable audio tags with the database audio path', () => {
    expect(buildAudioTag('/birds/audio/lanius-cristatus.ogg', '红尾伯劳')).toBe(
      '[audio:/birds/audio/lanius-cristatus.ogg|红尾伯劳]',
    )
  })

  it('matches audio by species name', () => {
    expect(findMatchingAudio('红尾伯劳的叫声', '这是红尾伯劳。', audios)?.audioUrl).toBe(
      '/birds/audio/lanius-cristatus.ogg',
    )
  })

  it('enriches replies when audio exists but the model only described the call', () => {
    const reply = enrichReplyWithAudio('红尾伯劳叫起来很急促。', '红尾伯劳的叫声', audios)
    expect(replyHasAudioTag(reply)).toBe(true)
    expect(reply).toContain('[audio:/birds/audio/lanius-cristatus.ogg|红尾伯劳]')
  })

  it('strips meta lines about auto-attached audio before inserting the player', () => {
    const reply = finalizeReplyAudio(
      '红尾伯劳叫声很清脆。（系统已自动附上红尾伯劳典型鸣声录音 ▶️）',
      '这个鸟的声音是什么样的',
      audios,
    )
    expect(reply).not.toContain('系统已自动附上')
    expect(reply).toContain('[audio:/birds/audio/lanius-cristatus.ogg|红尾伯劳]')
  })

  it('replaces model-written placeholder tags with the real audio path', () => {
    const reply = finalizeReplyAudio(
      '听听看：[audio:slug|红尾伯劳]',
      '红尾伯劳的叫声',
      audios,
    )
    expect(reply).toContain('[audio:/birds/audio/lanius-cristatus.ogg|红尾伯劳]')
    expect(reply).not.toContain('[audio:slug|')
  })

  it('attaches audio when the user confirms species and the reply discusses sound', () => {
    const reply = enrichReplyWithAudio(
      '红尾伯劳！你观察得很准。它的叫声像「咯咯咯」。本站正好有录音，可以对比听听。',
      '应该是红尾伯劳吧？',
      audios,
    )
    expect(reply).toContain('[audio:/birds/audio/lanius-cristatus.ogg|红尾伯劳]')
  })
})
