import { describe, expect, it } from 'vitest'

import { buildTutorGreeting } from '@/lib/ai/tutor/greeting'
import type { StudentProfileSnapshot, TutorSceneContext } from '@/lib/ai/tutor/types'

const baseProfile: StudentProfileSnapshot = {
  displayName: '小明',
  ageGroup: '10-12 岁',
  level: 3,
  xp: 400,
  memberDays: 30,
  radarSummary: '科学20、技术40',
  statsSummary: '完成项目2个',
  recentActivity: '探索中《太阳能小车》',
  text: '昵称：小明',
}

describe('buildTutorGreeting', () => {
  it('returns challenge-specific greeting', () => {
    const scene: TutorSceneContext = {
      contextType: 'challenge',
      contextId: '1',
      title: '鸡蛋保护舱',
      summary: '',
      stageIndex: 0,
      stageKind: 'observe',
    }
    const greeting = buildTutorGreeting(baseProfile, scene)
    expect(greeting.message).toContain('小迪')
    expect(greeting.message).toContain('鸡蛋保护舱')
    expect(greeting.quickPrompts.length).toBeGreaterThan(0)
  })

  it('returns global greeting for browsing', () => {
    const scene: TutorSceneContext = {
      contextType: 'global',
      contextId: '',
      title: 'STEAM 探索',
      summary: '',
    }
    const greeting = buildTutorGreeting(baseProfile, scene)
    expect(greeting.message).toContain('小明')
    expect(greeting.quickPrompts).toHaveLength(3)
  })

  it('returns surface-specific greetings for different global pages', () => {
    const buildScene = (surface: TutorSceneContext['surface']): TutorSceneContext => ({
      contextType: 'global',
      contextId: '',
      title: 'STEAM 探索',
      summary: '',
      surface,
    })

    const nature = buildTutorGreeting(baseProfile, buildScene('nature'))
    const playground = buildTutorGreeting(baseProfile, buildScene('playground'))
    const explore = buildTutorGreeting(baseProfile, buildScene('explore'))

    expect(nature.message).toContain('观察')
    expect(playground.message).toContain('游戏')
    // 不同页面开场白互不相同
    expect(new Set([nature.message, playground.message, explore.message]).size).toBe(3)
    expect(nature.quickPrompts).toHaveLength(3)
  })

  it('keeps personalized greeting on the home surface', () => {
    const scene: TutorSceneContext = {
      contextType: 'global',
      contextId: '',
      title: 'STEAM 探索',
      summary: '',
      surface: 'home',
    }
    // baseProfile.recentActivity 含「探索中」→ 首页走个性化分支
    const greeting = buildTutorGreeting(baseProfile, scene)
    expect(greeting.message).toContain('项目在进行中')
  })
})
