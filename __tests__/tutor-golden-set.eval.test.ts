import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  TUTOR_REPLY_GOLDEN_CASES,
  TUTOR_RESOURCE_GOLDEN_CASES,
  TUTOR_TOOL_GOLDEN_CASES,
  buildGoldenStudentProfile,
  evaluateTutorReply,
} from '@/lib/ai/tutor/golden-set'

/**
 * Golden-set 真实模型评估：调用 DashScope 检查 planner 决策与回答特征。
 *
 * 默认跳过（普通 `pnpm test` 不消耗 token）；运行方式：
 *   pnpm eval:tutor
 * 或 TUTOR_GOLDEN_SET=1 pnpm vitest run __tests__/tutor-golden-set.eval.test.ts
 *
 * 提示词 / planner 规则改动后先跑本评估，全部通过再上线。
 */

const RUN_GOLDEN_SET = process.env.TUTOR_GOLDEN_SET === '1'
const CASE_TIMEOUT_MS = 60_000

/** vitest 不会自动加载 Next 的 env 文件；补齐缺失的 DASHSCOPE_* 变量 */
function loadDashScopeEnv() {
  if (process.env.DASHSCOPE_API_KEY) return
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), file)
    if (!fs.existsSync(fullPath)) continue
    for (const line of fs.readFileSync(fullPath, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const key = match[1]
      if (process.env[key] !== undefined) continue
      process.env[key] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}

if (RUN_GOLDEN_SET) {
  loadDashScopeEnv()
}

describe.skipIf(!RUN_GOLDEN_SET)('tutor golden set — 工具决策 planner', () => {
  for (const goldenCase of TUTOR_TOOL_GOLDEN_CASES) {
    it(
      `${goldenCase.id}: ${goldenCase.description}`,
      async () => {
        const { planTutorToolDecision } = await import('@/lib/ai/tutor/tool-call-planner')
        const decision = await planTutorToolDecision({
          ...goldenCase.availability,
          content: goldenCase.message,
          previousMessages: goldenCase.previousMessages,
        })

        // availability 保证有可用工具，返回 null 说明模型输出不可解析
        expect(decision, '模型输出无法解析为决策 JSON').not.toBeNull()

        const actualTools = (decision?.toolCalls ?? []).map((call) => call.name).sort()
        expect(actualTools, `消息：${goldenCase.message}`).toEqual([...goldenCase.expectedTools].sort())

        for (const [toolName, expectedPayload] of Object.entries(goldenCase.expectedToolPayloads ?? {})) {
          const call = decision?.toolCalls.find((item) => item.name === toolName)
          expect(call, `缺少工具 ${toolName}`).toBeTruthy()
          const payload = (call?.payload ?? {}) as Record<string, unknown>
          for (const [key, value] of Object.entries(expectedPayload)) {
            expect(payload[key], `${toolName}.${key}`).toEqual(value)
          }
        }
      },
      CASE_TIMEOUT_MS,
    )
  }
})

describe.skipIf(!RUN_GOLDEN_SET)('tutor golden set — 资源检索 planner', () => {
  for (const goldenCase of TUTOR_RESOURCE_GOLDEN_CASES) {
    it(
      `${goldenCase.id}: ${goldenCase.description}`,
      async () => {
        const { planTutorResourceSearch } = await import('@/lib/ai/tutor/resource-search-planner')
        const plan = await planTutorResourceSearch(goldenCase.message, {
          previousMessages: goldenCase.previousMessages,
          ...goldenCase.plannerOptions,
        })

        // fallback 意味着模型输出解析失败，评估里视为失败而不是静默放过
        expect(plan.status, '资源 planner 走了 fallback').toBe('model')
        expect(plan.shouldSearch, `消息：${goldenCase.message}`).toBe(goldenCase.expectShouldSearch)

        if (goldenCase.expectClarification) {
          expect(plan.clarification, '应先返回结构化澄清选项').toBeTruthy()
          expect(plan.clarification?.options.length, '澄清选项应控制在 2-4 个').toBeGreaterThanOrEqual(2)
          expect(plan.clarification?.options.length, '澄清选项应控制在 2-4 个').toBeLessThanOrEqual(4)
        } else {
          expect(plan.clarification, '没有歧义时不应增加澄清轮次').toBeUndefined()
        }

        if (!goldenCase.expectShouldSearch) return

        for (const type of goldenCase.expectedResourceTypes ?? []) {
          expect(plan.resourceTypes, `资源类型应包含 ${type}`).toContain(type)
        }

        if (goldenCase.expectClarification) {
          expect(plan.clarification?.options.map((option) => option.label)).toEqual(
            expect.arrayContaining(['通用积木搭建', '大颗粒积木', '兼容乐高的积木/零件']),
          )
          return
        }

        expect(plan.queries.length, '应产出至少一条检索词').toBeGreaterThan(0)
        for (const pattern of goldenCase.queryMustMatch ?? []) {
          const regex = new RegExp(pattern, 'm')
          expect(
            plan.queries.some((query) => regex.test(query)),
            `检索词 ${JSON.stringify(plan.queries)} 未命中 ${pattern}`,
          ).toBe(true)
        }
      },
      CASE_TIMEOUT_MS,
    )
  }
})

describe.skipIf(!RUN_GOLDEN_SET)('tutor golden set — 回答特征', () => {
  for (const goldenCase of TUTOR_REPLY_GOLDEN_CASES) {
    it(
      `${goldenCase.id}: ${goldenCase.description}`,
      async () => {
        const [{ buildTutorSystemPrompt }, { chatWithTutorComplete }] = await Promise.all([
          import('@/lib/ai/tutor/prompt'),
          import('@/lib/ai/tutor/engine'),
        ])

        const systemPrompt = buildTutorSystemPrompt({
          scene: goldenCase.scene,
          profile: buildGoldenStudentProfile(goldenCase.profileOverrides),
          notebook: null,
        })
        const reply = await chatWithTutorComplete(
          systemPrompt,
          goldenCase.conversation.map((message) => ({ role: message.role, content: message.content })),
          { temperature: 0.3 },
        )

        const failures = evaluateTutorReply(reply, goldenCase.expectation)
        expect(failures, `回复全文：\n${reply}`).toEqual([])
      },
      CASE_TIMEOUT_MS,
    )
  }
})
