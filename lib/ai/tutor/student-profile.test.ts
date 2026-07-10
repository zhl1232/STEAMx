import { describe, expect, it } from 'vitest'

import {
  buildStudentDataAccessSummary,
  buildStudentLearningSignalsSummary,
  describeObservationActivity,
} from '@/lib/ai/tutor/student-profile'

describe('describeObservationActivity', () => {
  it('uses natural Chinese instead of internal topic/location format', () => {
    const text = describeObservationActivity('birds', '什刹海公园')

    expect(text).toBe('在什刹海公园观察过鸟类')
    expect(text).not.toContain('birds')
    expect(text).not.toContain('@')
  })

  it('falls back gracefully for missing topic and location', () => {
    expect(describeObservationActivity(null, null)).toBe('观察过自然')
  })
})

describe('buildStudentDataAccessSummary', () => {
  it('limits tutor-visible profile data to a safe summary', () => {
    const text = buildStudentDataAccessSummary({
      radar: {
        S: { raw: 72, display: 72, tier: 'intermediate', guidance: '挑战高难度科学项目可以解锁挑战段（75+）' },
        T: { raw: 64, display: 64, tier: 'foundation', guidance: '完成一个 3 星以上的技术项目来突破基础段' },
        E: { raw: 0, display: 0, tier: 'none', guidance: '还没探索过工程领域，去看看相关项目吧' },
        A: { raw: 51, display: 51, tier: 'foundation', guidance: null },
        M: { raw: 80, display: 80, tier: 'challenge', guidance: null },
      },
      statsSummary: '完成项目2个；观察物种3种',
      recentActivity: '完成《太阳能小车》',
      learningSignalsSummary: buildStudentLearningSignalsSummary([
        '成长任务：已完成 3/5；下一项「连续探索 3 天」（2/3）',
        '课程进度：在学《Scratch 入门》的「出场动画」',
        '游乐场：玩过 6 个小游戏；累计胜利/通关 12 次',
        'AI 额度：今日免费剩余 4/5 次',
      ]),
    })

    expect(text).toContain('STEAM 能力雷达')
    expect(text).toContain('科学72')
    expect(text).toContain('累计统计：完成项目2个；观察物种3种')
    expect(text).toContain('学习信号')
    expect(text).toContain('成长任务：已完成 3/5')
    expect(text).toContain('课程进度：在学《Scratch 入门》的「出场动画」')
    expect(text).toContain('游乐场：玩过 6 个小游戏')
    expect(text).toContain('AI 额度：今日免费剩余 4/5 次')
    expect(text).toContain('不可见：手机号、私信正文、账号安全设置、支付信息')
    expect(text).toContain('原始定位')
  })
})
