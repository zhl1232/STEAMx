import { describe, expect, it } from 'vitest'

import { buildTutorSystemPrompt } from '@/lib/ai/tutor/prompt'
import type { StudentProfileSnapshot, TutorSceneContext } from '@/lib/ai/tutor/types'

const profile: StudentProfileSnapshot = {
  displayName: '小明',
  ageGroup: '10-12 岁',
  level: 4,
  xp: 900,
  memberDays: 20,
  radarSummary: '科学72、技术64、工程0、艺术51、数学80',
  statsSummary: '完成项目2个；观察物种3种',
  recentActivity: '完成《太阳能小车》',
  learningSignalsSummary: '课程进度：在学《Scratch 入门》的「出场动画」',
  dataAccessSummary: [
    '小迪当前可见的个人中心摘要：昵称、年龄段、等级/XP、加入天数、STEAM 能力雷达、累计统计、近期探索活动。',
    '能力雷达：科学72；技术64；工程0；艺术51；数学80',
    '学习信号：',
    '课程进度：在学《Scratch 入门》的「出场动画」',
    '不可见：手机号、私信正文、账号安全设置、支付信息、精确生日、完整后台记录、原始定位与未提供的其他隐私数据。',
  ].join('\n'),
  text: [
    '昵称：小明',
    '年龄段：10-12 岁',
    '等级 Lv.4（XP 900），加入 20 天',
    'STEAM 雷达：科学72、技术64、工程0、艺术51、数学80，相对薄弱：工程',
  ].join('\n'),
}

const scene: TutorSceneContext = {
  contextType: 'global',
  contextId: '',
  title: '回顾成长',
  summary: '学生正在查看自己的主页和成长记录。',
  surface: 'profile',
}

describe('buildTutorSystemPrompt', () => {
  it('identifies the platform brand separately from Xiaodi’s tutor nickname', () => {
    const prompt = buildTutorSystemPrompt({ scene, profile, notebook: null })

    expect(prompt).toContain('STEAMX · 史迪姆')
    expect(prompt).toContain('平台中文名是「史迪姆」')
    expect(prompt).toContain('导师昵称「小迪」')
    expect(prompt).not.toContain('吉祥物全名')
  })

  it('teaches Xiaodi to disclose only safe profile summaries', () => {
    const prompt = buildTutorSystemPrompt({ scene, profile, notebook: null })

    expect(prompt).toContain('个人数据可见性')
    expect(prompt).toContain('【个人中心可见范围】')
    expect(prompt).toContain('我能看到这些摘要')
    expect(prompt).toContain('不要声称能看到完整个人中心')
    expect(prompt).toContain('手机号、私信、账号安全、支付信息')
    expect(prompt).toContain('能力雷达：科学72；技术64；工程0')
    expect(prompt).toContain('课程进度：在学《Scratch 入门》的「出场动画」')
    expect(prompt).toContain('STEAM 雷达：科学72、技术64、工程0、艺术51、数学80')
  })

  it('requires guided hints instead of direct answers for learning exercises', () => {
    const prompt = buildTutorSystemPrompt({ scene, profile, notebook: null })

    expect(prompt).toContain('习题、测验、作业、谜题、棋盘或闯关题')
    expect(prompt).toContain('优先级高于「回答策略」')
    expect(prompt).toContain('不直接给最终答案、正确选项、完整解法或精确落点')
    expect(prompt).toContain('每次只给一个最小线索')
    expect(prompt).toContain('即使他直接索要答案，也一律按引导处理')
  })

  it('requires scene fact points to override vague model guesses', () => {
    const prompt = buildTutorSystemPrompt({ scene, profile, notebook: null })

    expect(prompt).toContain('事实准确性')
    expect(prompt).toContain('事实要点')
    expect(prompt).toContain('不要用「尚未证明」')
  })

  it('keeps personal history out of default knowledge replies', () => {
    const prompt = buildTutorSystemPrompt({ scene, profile, notebook: null })

    expect(prompt).toContain('默认不要主动提学生过去做过什么、去过哪里或看过哪些记录')
    expect(prompt).toContain('不要把后台记录加工成生硬的反问')
    expect(prompt).not.toContain('学生曾在某地观察过，只能说')
  })

  it('allows course recommendation chips in replies', () => {
    const prompt = buildTutorSystemPrompt({ scene, profile, notebook: null })

    expect(prompt).toContain('[course:ID|标题]')
    expect(prompt).toContain('[project:ID|标题]')
  })

  it('keeps resource lookup independent from the current page and avoids false negatives', () => {
    const prompt = buildTutorSystemPrompt({ scene, profile, notebook: null })

    expect(prompt).toContain('当前页面场景不是检索范围')
    expect(prompt).toContain('检索结果为空或检索不完整时，只能说「我暂时没查到」')
    expect(prompt).toContain('用户说“项目”但命中的是课程中的课时时')
  })
})
