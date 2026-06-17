import { describe, expect, it } from 'vitest'

import {
  areStageArtifactSnapshotsEqual,
  buildStageArtifactSnapshot,
  getStageDataSummary,
  shouldKeepStageFeedback,
} from '@/lib/pbl/challenge-stage-progress'

const feedback = {
  strengths: ['结构清楚'],
  gaps: ['缺少测试数据'],
  nextActions: ['补一次对比测试'],
  generatedAt: '2026-06-17T09:00:00.000Z',
}

describe('stage artifact snapshots', () => {
  it('normalizes notes, images, summary, checked items, and video url', () => {
    const snapshot = buildStageArtifactSnapshot({
      notes: '  做了纸板模型  ',
      images: ['a.jpg', 'a.jpg', 'b.jpg'],
      data: { summary: ' 承重 200g 通过 ', checked: [2, 0, 2, -1, 'bad'] },
      videoUrl: '  /video.mp4  ',
    })

    expect(snapshot).toEqual({
      notes: '做了纸板模型',
      images: ['a.jpg', 'b.jpg'],
      dataSummary: '承重 200g 通过',
      checked: [0, 2],
      videoUrl: '/video.mp4',
    })
  })

  it('detects meaningful artifact changes', () => {
    const previous = buildStageArtifactSnapshot({
      notes: '做了纸板模型',
      images: ['a.jpg'],
      data: { summary: '承重 200g 通过', checked: [0] },
    })
    const unchanged = buildStageArtifactSnapshot({
      notes: ' 做了纸板模型 ',
      images: ['a.jpg'],
      data: { summary: ' 承重 200g 通过 ', checked: [0] },
    })
    const changed = buildStageArtifactSnapshot({
      notes: '改成木棒模型',
      images: ['a.jpg'],
      data: { summary: '承重 200g 通过', checked: [0] },
    })

    expect(areStageArtifactSnapshotsEqual(previous, unchanged)).toBe(true)
    expect(areStageArtifactSnapshotsEqual(previous, changed)).toBe(false)
  })

  it('keeps feedback only when an existing feedback matches unchanged artifact content', () => {
    const previous = buildStageArtifactSnapshot({
      notes: '做了纸板模型',
      data: { summary: '承重 200g 通过' },
    })
    const changed = buildStageArtifactSnapshot({
      notes: '做了纸板模型',
      data: { summary: '轻推会晃动' },
    })

    expect(shouldKeepStageFeedback({ existingFeedback: feedback, previous, next: previous })).toBe(true)
    expect(shouldKeepStageFeedback({ existingFeedback: feedback, previous, next: changed })).toBe(false)
    expect(shouldKeepStageFeedback({ existingFeedback: null, previous, next: previous })).toBe(false)
  })

  it('extracts a trimmed structured summary for validation', () => {
    expect(getStageDataSummary({ summary: '  测试记录  ' })).toBe('测试记录')
    expect(getStageDataSummary({ summary: 123 })).toBe('')
    expect(getStageDataSummary(null)).toBe('')
  })
})
