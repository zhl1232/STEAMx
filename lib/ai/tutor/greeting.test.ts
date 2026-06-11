import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildTutorGreeting, clearTutorGreetingCache, getSmartTutorGreeting } from '@/lib/ai/tutor/greeting'
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

afterEach(() => {
  clearTutorGreetingCache()
})

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

  it('returns species-specific greeting on species detail pages', () => {
    const scene: TutorSceneContext = {
      contextType: 'species',
      contextId: 'turdus-merula',
      title: '乌鸫',
      summary: '识别要点：…',
    }
    const greeting = buildTutorGreeting(baseProfile, scene)
    expect(greeting.message).toContain('乌鸫')
    expect(greeting.quickPrompts).toContain('怎么认出它？')
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

  it('uses generated greeting and caches it for the same scene', async () => {
    const scene: TutorSceneContext = {
      contextType: 'species',
      contextId: 'turdus-merula',
      title: '乌鸫',
      summary: '页面下方有「鸟鸣音频」卡。',
    }
    const generate = vi.fn(async () => ({
      message: '小明，乌鸫这页可以边看特征边听鸟鸣。',
      quickPrompts: ['怎么认它', '听叫声', '在哪观察'],
    }))

    const first = await getSmartTutorGreeting({
      userId: 'user-1',
      profile: baseProfile,
      scene,
      notebook: null,
      generate,
    })
    const second = await getSmartTutorGreeting({
      userId: 'user-1',
      profile: baseProfile,
      scene,
      notebook: null,
      generate,
    })

    expect(first).toEqual(second)
    expect(first.message).toContain('鸟鸣')
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('falls back to template when generated greeting is invalid', async () => {
    const scene: TutorSceneContext = {
      contextType: 'species',
      contextId: 'turdus-merula',
      title: '乌鸫',
      summary: '',
    }
    const generate = vi.fn(async () => ({
      message: '这是一条明显过长、超过限制、应该被丢弃的开场白，因为它会让聊天面板又回到冗长不自然的问题状态。',
      quickPrompts: ['这个快捷问题也太长了'],
    }))

    const greeting = await getSmartTutorGreeting({
      userId: 'user-1',
      profile: baseProfile,
      scene,
      notebook: null,
      generate,
    })

    expect(greeting.message).toContain('乌鸫')
    expect(generate).toHaveBeenCalledTimes(1)
  })
})
