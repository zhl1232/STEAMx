import { describe, expect, it } from 'vitest'

import type { ChallengeStage, StageProgress } from '@/lib/mappers/types'
import type { ChallengeWorkspace } from '@/lib/pbl/challenge-workspace'
import {
  buildStageProgressSummary,
  buildStageReviewArtifact,
  buildStageReviewContext,
} from '@/lib/pbl/challenge-stage-review'

const stages: ChallengeStage[] = [
  {
    title: '观察真实需求',
    description: '记录谁会使用这个空间。',
    kind: 'observe',
    checklist: ['记录地点', '采访使用者'],
  },
  {
    title: '制作并测试原型',
    description: '做一个可测试模型。',
    hint: '每次只改一个变量。',
    kind: 'build_test',
    checklist: ['有测试数据', '有照片证据'],
  },
]

const progressList: StageProgress[] = [
  {
    stageIndex: 0,
    status: 'completed',
    notes: '午休区中午很晒，三位同学都希望有阴影。',
    images: [],
  },
  {
    stageIndex: 1,
    status: 'in_progress',
    notes: '做了纸板模型。',
    images: ['https://example.com/model.jpg'],
    data: {
      summary: '承重 200g 通过，轻推会晃动。',
      checked: [0],
    },
  },
]

const workspace: ChallengeWorkspace = {
  projectGoal: '做一个适合操场午休区的小型遮阳模型',
  updatedAt: '2026-06-15T08:01:00.000Z',
  personalPlan: {
    version: 1,
    sourceGoal: '做一个适合操场午休区的小型遮阳模型',
    generatedAt: '2026-06-15T08:00:00.000Z',
    stageCount: 2,
    steps: [
      {
        stageIndex: 1,
        title: '制作并测试原型',
        focus: '把遮阳模型做成可测试的原型。',
        evidencePrompt: '记录测试条件、关键数据和失败现象。',
        checkpointPrompt: '每次测试只改一个主要变量。',
      },
    ],
  },
}

describe('buildStageReviewArtifact', () => {
  it('combines notes, structured data, checked checklist labels, and images', () => {
    const artifact = buildStageReviewArtifact({
      notes: '做了纸板模型。',
      images: ['https://example.com/model.jpg'],
      data: { summary: '承重 200g 通过。', checked: [0] },
      stage: stages[1],
    })

    expect(artifact.imageUrls).toEqual(['https://example.com/model.jpg'])
    expect(artifact.notes).toContain('做了纸板模型。')
    expect(artifact.notes).toContain('关键数据 / 补充记录：承重 200g 通过。')
    expect(artifact.notes).toContain('已勾选完成清单：有测试数据')
  })
})

describe('buildStageProgressSummary', () => {
  it('includes workspace goal, personal prompt, and current stage marker', () => {
    const summary = buildStageProgressSummary({
      stages,
      progressList,
      currentStageIndex: 1,
      workspace,
    })

    expect(summary).toContain('学生自己的项目方向：做一个适合操场午休区的小型遮阳模型')
    expect(summary).toContain('当前阶段个人化提示：把遮阳模型做成可测试的原型。')
    expect(summary).toContain('第1步「观察真实需求」[已完成]')
    expect(summary).toContain('当前 第2步「制作并测试原型」[进行中]')
    expect(summary).toContain('数据：承重 200g 通过，轻推会晃动。')
  })
})

describe('buildStageReviewContext', () => {
  it('builds a stage coach context for structured review', () => {
    const context = buildStageReviewContext({
      challenge: {
        title: '校园遮阳休息站挑战',
        drivingQuestion: '怎样让午休区更舒服？',
        constraints: ['低成本材料'],
      },
      stages,
      stageIndex: 1,
      progressList,
      workspace,
    })

    expect(context.challengeTitle).toBe('校园遮阳休息站挑战')
    expect(context.stageTitle).toBe('制作并测试原型')
    expect(context.stageKind).toBe('build_test')
    expect(context.currentStageIndex).toBe(1)
    expect(context.totalStages).toBe(2)
    expect(context.progressSummary).toContain('每次测试只改一个主要变量。')
  })
})
