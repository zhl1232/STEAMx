import { describe, expect, it } from 'vitest'

import {
  buildChallengePersonalPlan,
  mapChallengeWorkspace,
  normalizeProjectGoal,
  parseChallengePersonalPlan,
} from '@/lib/pbl/challenge-workspace'
import type { ChallengeStage } from '@/lib/mappers/types'
import { ChallengeWorkspaceUpdateSchema } from '@/lib/schemas'

const stages: ChallengeStage[] = [
  {
    title: '观察真实需求',
    description: '记录谁会使用这个空间。',
    kind: 'observe',
  },
  {
    title: '制作并测试原型',
    description: '制作一个可测试模型。',
    kind: 'build_test',
  },
]

describe('challenge workspace personal plan', () => {
  it('normalizes project goals before building a plan', () => {
    expect(normalizeProjectGoal('  做一个\n遮阳  模型  ')).toBe('做一个 遮阳 模型')
  })

  it('builds stable stage prompts from a project goal', () => {
    const plan = buildChallengePersonalPlan({
      projectGoal: '做一个适合操场午休区的小型遮阳模型',
      stages,
      now: new Date('2026-06-15T08:00:00.000Z'),
    })

    expect(plan).toMatchObject({
      version: 1,
      sourceGoal: '做一个适合操场午休区的小型遮阳模型',
      generatedAt: '2026-06-15T08:00:00.000Z',
      stageCount: 2,
    })
    expect(plan?.steps).toHaveLength(2)
    expect(plan?.steps[0]).toMatchObject({
      stageIndex: 0,
      title: '观察真实需求',
      evidencePrompt: '记录观察地点、对象、时间和你发现的关键问题。',
    })
    expect(plan?.steps[1].focus).toContain('可测试的原型')
  })

  it('returns null for an empty goal', () => {
    expect(buildChallengePersonalPlan({ projectGoal: '   ', stages })).toBeNull()
  })

  it('maps persisted workspace rows into UI-safe shape', () => {
    const plan = buildChallengePersonalPlan({
      projectGoal: '做一个遮阳模型',
      stages,
      now: new Date('2026-06-15T08:00:00.000Z'),
    })

    const workspace = mapChallengeWorkspace({
      project_goal: '做一个遮阳模型',
      personal_plan: plan,
      updated_at: '2026-06-15T08:01:00.000Z',
    })

    expect(workspace.projectGoal).toBe('做一个遮阳模型')
    expect(workspace.personalPlan?.steps[0].stageIndex).toBe(0)
    expect(workspace.updatedAt).toBe('2026-06-15T08:01:00.000Z')
  })

  it('rejects malformed persisted plans without throwing', () => {
    expect(parseChallengePersonalPlan({ version: 2, steps: [] })).toBeNull()
  })

  it('requires project_goal in workspace update payloads', () => {
    expect(ChallengeWorkspaceUpdateSchema.safeParse({}).success).toBe(false)
    expect(ChallengeWorkspaceUpdateSchema.safeParse({ project_goal: null }).success).toBe(true)
    expect(ChallengeWorkspaceUpdateSchema.safeParse({ project_goal: '做一个模型' }).success).toBe(true)
  })
})
