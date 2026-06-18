import { describe, expect, it } from 'vitest'

import type { ChallengeStage, StageProgress } from '@/lib/mappers/types'
import type { ChallengeWorkspace } from '@/lib/pbl/challenge-workspace'
import {
  buildChallengeSubmissionDraft,
  normalizeChallengeSubmissionDraft,
} from '@/lib/pbl/challenge-submission-draft'

const stages: ChallengeStage[] = [
  {
    title: '观察真实需求',
    description: '记录真实使用场景。',
    kind: 'observe',
    checklist: ['记录地点', '采访使用者'],
  },
  {
    title: '制作并测试原型',
    description: '做一个可测试模型。',
    kind: 'build_test',
    checklist: ['有测试数据', '有照片证据'],
  },
  {
    title: '迭代方案',
    description: '根据测试结果改进。',
    kind: 'iterate',
    checklist: ['前后对比', '说明取舍'],
  },
]

const progressList: StageProgress[] = [
  {
    stageIndex: 0,
    status: 'completed',
    notes: '操场午休区中午很晒，三位同学都希望有阴影。',
    images: ['/storage/v1/object/public/project-completions/u/a.jpg'],
    data: { checked: [0, 1] },
  },
  {
    stageIndex: 1,
    status: 'completed',
    notes: '做了纸板模型。',
    images: [
      '/storage/v1/object/public/project-completions/u/a.jpg',
      '/storage/v1/object/public/project-completions/u/b.jpg',
    ],
    data: { summary: '承重 200g 通过，轻推会晃动。', checked: [0] },
    aiFeedback: {
      strengths: ['已经有测试数据'],
      gaps: ['缺少前后对比'],
      nextActions: ['补一次只改一个变量的测试'],
      generatedAt: '2026-06-17T09:00:00.000Z',
    },
  },
  {
    stageIndex: 2,
    status: 'in_progress',
    notes: '把支架加宽，稳定性变好，但用料增加。',
    images: [],
    data: { summary: '改进后轻推不倒。' },
  },
]

const workspace: ChallengeWorkspace = {
  projectGoal: '做一个适合操场午休区的小型遮阳模型',
  personalPlan: null,
  updatedAt: '2026-06-17T08:00:00.000Z',
}

describe('buildChallengeSubmissionDraft', () => {
  it('turns stage progress into an editable submission draft', () => {
    const draft = buildChallengeSubmissionDraft({
      challenge: {
        title: '校园遮阳休息站挑战',
        drivingQuestion: '怎样让午休区更舒服？',
        expectedOutcome: '一个可测试的遮阳原型',
        constraints: ['低成本材料'],
        steamWeights: { S: 20, E: 40, A: 10 },
      },
      stages,
      progressList,
      workspace,
    })

    expect(draft.title).toBe('做一个适合操场午休区的小型遮阳模型')
    expect(draft.notes).toContain('【作品说明】')
    expect(draft.notes).toContain('我重点回应的问题是：怎样让午休区更舒服？')
    expect(draft.notes).toContain('第 2 步「制作并测试原型」：承重 200g 通过，轻推会晃动。')
    expect(draft.notes).toContain('【反思记录】')
    expect(draft.notes).toContain('还需要改进：缺少前后对比。')
    expect(draft.notes).toContain('【STEAM 能力收获】')
    expect(draft.images).toEqual([
      '/storage/v1/object/public/project-completions/u/a.jpg',
      '/storage/v1/object/public/project-completions/u/b.jpg',
    ])
    expect(draft.steamInsights.map((item) => item.key)).toEqual(['E', 'S', 'A'])
    expect(draft.source).toBe('local')
  })

  it('falls back to a challenge title when no personal goal exists', () => {
    const draft = buildChallengeSubmissionDraft({
      challenge: { title: '鸡蛋保护舱挑战' },
      stages: [],
      progressList: [],
    })

    expect(draft.title).toBe('鸡蛋保护舱挑战记录')
    expect(draft.notes).toContain('我围绕「鸡蛋保护舱挑战」完成了这份挑战作品。')
    expect(draft.images).toEqual([])
  })
})

describe('normalizeChallengeSubmissionDraft', () => {
  it('keeps a usable fallback when AI returns partial or invalid values', () => {
    const fallback = buildChallengeSubmissionDraft({
      challenge: { title: '校园遮阳休息站挑战', steamWeights: { E: 50 } },
      stages,
      progressList,
      workspace,
    })

    const normalized = normalizeChallengeSubmissionDraft({
      fallback,
      draft: {
        title: '  AI 整理标题  ',
        notes: '',
        images: ['', '/x.jpg', '/x.jpg'],
        steamInsights: [
          { key: 'E', label: '工程', evidence: '对照测试结果改进支架。' },
          { key: 'bad' as 'E', label: '坏数据', evidence: '忽略' },
        ],
        source: 'ai',
      },
    })

    expect(normalized.title).toBe('AI 整理标题')
    expect(normalized.notes).toBe(fallback.notes)
    expect(normalized.images).toEqual(['/x.jpg'])
    expect(normalized.steamInsights).toEqual([
      { key: 'E', label: '工程', evidence: '对照测试结果改进支架。' },
    ])
    expect(normalized.source).toBe('ai')
  })
})
