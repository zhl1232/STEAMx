import { describe, expect, it } from 'vitest'

import {
  TUTOR_REPLY_GOLDEN_CASES,
  TUTOR_REPLY_UNIVERSAL_RULES,
  TUTOR_RESOURCE_GOLDEN_CASES,
  TUTOR_TOOL_GOLDEN_CASES,
  buildGoldenStudentProfile,
  evaluateTutorReply,
} from '@/lib/ai/tutor/golden-set'
import { getAvailableTutorTools } from '@/lib/ai/tutor/tool-registry'

/**
 * golden-set 的结构校验：不调用模型，保证数据集本身自洽，
 * 避免评估跑起来才发现 availability 配置根本启用不了期望的工具。
 */

describe('tutor golden set dataset', () => {
  it('所有用例 id 全局唯一', () => {
    const ids = [
      ...TUTOR_TOOL_GOLDEN_CASES.map((c) => c.id),
      ...TUTOR_RESOURCE_GOLDEN_CASES.map((c) => c.id),
      ...TUTOR_REPLY_GOLDEN_CASES.map((c) => c.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('工具用例的期望工具在其 availability 下确实可用', () => {
    for (const goldenCase of TUTOR_TOOL_GOLDEN_CASES) {
      const available = getAvailableTutorTools(goldenCase.availability).map((tool) => tool.name)
      // planner 只有在页面存在可用工具时才会被调用；空期望用例也必须有可用工具，
      // 否则该用例测不到「模型主动返回无动作」。
      expect(available.length, goldenCase.id).toBeGreaterThan(0)
      for (const expected of goldenCase.expectedTools) {
        expect(available, goldenCase.id).toContain(expected)
      }
      for (const payloadTool of Object.keys(goldenCase.expectedToolPayloads ?? {})) {
        expect(goldenCase.expectedTools, goldenCase.id).toContain(payloadTool)
      }
    }
  })

  it('资源用例的资源类型与正则合法', () => {
    for (const goldenCase of TUTOR_RESOURCE_GOLDEN_CASES) {
      for (const type of goldenCase.expectedResourceTypes ?? []) {
        expect(['course', 'project'], goldenCase.id).toContain(type)
      }
      for (const pattern of goldenCase.queryMustMatch ?? []) {
        expect(() => new RegExp(pattern, 'm'), goldenCase.id).not.toThrow()
      }
      if (!goldenCase.expectShouldSearch) {
        expect(goldenCase.expectedResourceTypes, goldenCase.id).toBeUndefined()
        expect(goldenCase.queryMustMatch, goldenCase.id).toBeUndefined()
      }
    }
  })

  it('回答用例场景字段齐全、正则合法、最后一条是学生消息', () => {
    for (const goldenCase of TUTOR_REPLY_GOLDEN_CASES) {
      expect(goldenCase.scene.title, goldenCase.id).toBeTruthy()
      expect(goldenCase.scene.summary, goldenCase.id).toBeTruthy()
      expect(goldenCase.conversation.length, goldenCase.id).toBeGreaterThan(0)
      expect(goldenCase.conversation.at(-1)?.role, goldenCase.id).toBe('user')
      const patterns = [
        ...(goldenCase.expectation.mustMatch ?? []),
        ...(goldenCase.expectation.mustNotMatch ?? []),
      ]
      for (const pattern of patterns) {
        expect(() => new RegExp(pattern, 'm'), goldenCase.id).not.toThrow()
      }
    }
  })

  it('默认画像可被覆盖', () => {
    const profile = buildGoldenStudentProfile({ dataAccessSummary: '仅能力雷达' })
    expect(profile.displayName).toBe('小柏')
    expect(profile.dataAccessSummary).toBe('仅能力雷达')
    expect(profile.text).toContain('小柏')
  })
})

describe('evaluateTutorReply', () => {
  it('合规回复返回空失败列表', () => {
    const failures = evaluateTutorReply('先看看 3 和 6 之间差了多少，你发现规律了吗？', {
      maxChars: 100,
      mustNotMatch: ['15'],
    })
    expect(failures).toEqual([])
  })

  it('命中红线：自称 AI、URL、代码块、标题、表格', () => {
    expect(evaluateTutorReply('作为AI，我觉得不错', {})).not.toEqual([])
    expect(evaluateTutorReply('你可以看 https://example.com', {})).not.toEqual([])
    expect(evaluateTutorReply('```js\nconsole.log(1)\n```', {})).not.toEqual([])
    expect(evaluateTutorReply('# 今日总结\n内容', {})).not.toEqual([])
    expect(evaluateTutorReply('| 名称 | 数量 |\n| --- | --- |', {})).not.toEqual([])
  })

  it('标题规则只匹配行首 #，不误伤行中话题标签', () => {
    expect(evaluateTutorReply('这个 #夏日挑战 活动很有趣', {})).toEqual([])
  })

  it('超长回复报告 maxChars 失败', () => {
    const failures = evaluateTutorReply('好'.repeat(120), { maxChars: 100 })
    expect(failures.some((f) => f.includes('回复过长'))).toBe(true)
  })

  it('mustMatch 未命中与 mustNotMatch 命中都会失败', () => {
    const failures = evaluateTutorReply('麻雀喜欢在城市里活动。', {
      mustMatch: ['谷物|草籽'],
      mustNotMatch: ['城市'],
    })
    expect(failures).toHaveLength(2)
  })

  it('空回复直接失败', () => {
    expect(evaluateTutorReply('   ', {})).toEqual(['回复为空'])
  })

  it('红线规则的正则都能编译', () => {
    for (const rule of TUTOR_REPLY_UNIVERSAL_RULES) {
      expect(() => new RegExp(rule.pattern, 'm')).not.toThrow()
    }
  })
})
