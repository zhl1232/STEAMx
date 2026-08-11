import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/tutor/engine', () => ({
  chatWithTutorComplete: vi.fn(),
}))

import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'

import {
  buildAudioTag,
  finalizeReplyAudio,
  planTutorAudioAttachment,
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

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('builds stable audio tags with the database audio path', () => {
    expect(buildAudioTag('/birds/audio/lanius-cristatus.ogg', '红尾伯劳')).toBe(
      '[audio:/birds/audio/lanius-cristatus.ogg|红尾伯劳]',
    )
  })

  it('lets the planner decide whether a candidate audio should be attached', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"shouldAttach":true,"slug":"lanius-cristatus"}',
    )

    await expect(
      planTutorAudioAttachment('可以听听红尾伯劳的声音吗？', '它的叫声比较清脆。', audios),
    ).resolves.toEqual(audios[0])
    expect(vi.mocked(chatWithTutorComplete).mock.calls[0]?.[0]).toContain('不要用固定关键词或正则表达式判断意图')
  })

  it('does not attach audio when the model declines even if text mentions sound', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue('{"shouldAttach":false}')

    await expect(
      planTutorAudioAttachment('红尾伯劳的声音是什么？', '红尾伯劳常见于开阔林缘。', audios),
    ).resolves.toBeNull()
  })

  it('strips meta lines about auto-attached audio before inserting the player', () => {
    const reply = finalizeReplyAudio(
      '红尾伯劳叫声很清脆。（系统已自动附上红尾伯劳典型鸣声录音 ▶️）',
      audios[0],
    )
    expect(reply).not.toContain('系统已自动附上')
    expect(reply).toContain('[audio:/birds/audio/lanius-cristatus.ogg|红尾伯劳]')
  })

  it('replaces model-written placeholder tags with the real audio path', () => {
    const reply = finalizeReplyAudio(
      '听听看：[audio:slug|红尾伯劳]',
      audios[0],
    )
    expect(reply).toContain('[audio:/birds/audio/lanius-cristatus.ogg|红尾伯劳]')
    expect(reply).not.toContain('[audio:slug|')
  })

  it('does not attach a player without a model-selected audio', () => {
    const reply = finalizeReplyAudio('红尾伯劳叫声很清脆。', null)
    expect(reply).not.toContain('[audio:')
  })
})
