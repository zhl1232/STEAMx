import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'
import {
  normalizeTutorResourceClarification,
  type TutorResourceClarification,
} from '@/lib/ai/tutor/resource-clarification'

export const TUTOR_RESOURCE_TYPES = ['course', 'project'] as const
export type TutorResourceType = (typeof TUTOR_RESOURCE_TYPES)[number]

export type TutorResourceSearchPlan = {
  status: 'model' | 'fallback'
  shouldSearch: boolean
  /** 由模型从当前消息提取的 1-4 个主题短语；不是服务端关键词白名单。 */
  queries: string[]
  resourceTypes: TutorResourceType[]
  /** 任何关键信息不足以可靠回答时，先让学生确认范围；资源检索会在确认后继续。 */
  clarification?: TutorResourceClarification
}

export type TutorResourcePlannerHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

const RESOURCE_PLANNER_PROMPT = [
  '你是 STEAM 探索站的对话前置规划器，不负责回答学生问题。你同时判断是否需要查找站内课程/课时/项目，以及学生当前表达是否缺少回答所需的关键信息。',
  '先做“能不能可靠理解”的前置检查：只有当缺少的信息是给出有用回答所必需的，并且不同的合理理解会导致明显不同的答案或检索结果时，才返回 clarification，让学生先从 2-4 个简短选项里确认。这个规则适用于所有对话，不只是资源检索；如果可以先给出对大多数理解都适用的回答，就不要因为“还可以了解更多”而澄清。',
  '清楚的知识型问题（例如“猫头鹰晚上为什么能看见东西？”）默认直接回答，不要追问它想了解哪一个角度；知识问题可以在回答中自然补充重点。只有代词无指向、任务目标互相冲突或缺少必要范围时才澄清。',
  '如果学生明确是在问当前课时、当前步骤、这一步积木怎么操作或怎么拼，且当前场景/最近对话足以确定对象，必须 shouldSearch=false 且不要 clarification；这是当前学习指导，不是资源检索。若只说“这个怎么做”而没有可确定的对象，则应先 clarification。',
  '如果学生是在寻找、比较、推荐或确认站内课程、课程课时、项目挑战或项目，shouldSearch=true；明确的知识问答、题目讲解、闲聊且表达清楚时 shouldSearch=false。当前页面、当前课程和页面标题不能限制检索范围。',
  '当前页面、当前课程和页面标题不能限制检索范围；学生可能在任意页面找任意课程或项目。',
  '如果 shouldSearch=true，提取 1-4 个最能定位资源的主题短语，例如作品名、物体、技能、学科、玩法或材料。学生用“这个/那个/更难的/类似的”等指代时，必须结合最近对话把指代还原成具体主题（例如上文在聊编程课，“更难一点的”应还原为“编程”“Scratch”）。每个短语必须独立可检索；不要把“课程/项目/有没有/推荐”等意图词或“更难一点”这类只有难度、指代的词当作主题短语。如果只是泛问“有什么课程/项目”，queries 可以为空。',
  '短语要拆到最小可检索单元：品牌、材料、年龄段等修饰词必须和主体名词分开输出，不要拼成一个长词。例如“乐高轮船”拆成「乐高」「轮船」，“纸板小车模型”拆成「纸板」「小车」。资源标题里通常只出现主体名词，拼接后的长词会一条都查不到。',
  'resourceTypes 只能填写 course、project；如果学生没有明确区分，两个都填。',
  '资源请求若已经明确（如“大颗粒积木课程”“兼容乐高的零件”“Scratch 入门课”），直接检索，不要再问。若资源类型或主题不明确（如“有没有相关的”“有什么课”“乐高那里有没有车”），先 clarification，不要把空 queries 当作“先查一大串结果”。',
  '积木只是一个示例：当学生只说“积木”或提到“乐高”但没有明确规格，且无法判断是通用积木搭建、大颗粒积木还是兼容乐高的积木/零件时，可使用这三个选项：通用积木搭建、大颗粒积木、兼容乐高的积木/零件；重要示例“有没有乐高轮船的课程”“乐高那里有没有车相关的”也先确认规格。选项 id 可用 general-bricks、large-bricks、lego-compatible。其他领域要根据当前问题生成合适的 2-4 个选项，不要总套用积木选项。',
  '边界示例必须遵守：输入“有没有乐高轮船的课程”或“乐高那里有没有车相关的”时，主题虽然明确，但积木规格仍会改变结果，必须输出 clarification；输入“猫头鹰晚上为什么能看见东西？”时，输出 shouldSearch=false 且省略 clarification。',
  '如果返回 clarification，queries 可以为空；shouldSearch 表示学生确认后是否要检索资源。澄清选项必须是 2-4 个短选项，且下一轮学生选择其中一个后按选择内容直接处理；当最近一条小迪消息在问“哪一种/选一个”，当前消息又是短选项时，必须 shouldSearch=true，不能把它当成普通闲聊。',
  'clarification 的 JSON 形状固定为 {"prompt":"简短问题","options":[{"id":"option-id","label":"选项文字"},{"id":"another-id","label":"另一个选项"}]}；不要把 options 写成解释段落。',
  '如果当前消息附带图片，图片可能包含回答所需对象；不要仅因为文字短就澄清，除非文字本身仍有多个无法区分的任务。',
  '输出前自检：如果问题是“有没有乐高轮船的课程”，不能只因为“轮船”已经明确就跳过规格澄清；必须同时 needsClarification=true、shouldSearch=true、queries=[]，并提供“通用积木搭建”“大颗粒积木”“兼容乐高的积木/零件”三个选项。',
  '只输出一行 JSON，不要 Markdown、解释或回答。必须同时输出 needsClarification（true/false）；需要澄清时 needsClarification=true 并给 clarification，不需要时 needsClarification=false 且省略 clarification。格式：{"needsClarification":false,"shouldSearch":false,"queries":[],"resourceTypes":["course","project"]}。',
].join('\n')

function compact(value: string, max: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, max)
}

function safeQuery(value: unknown) {
  if (typeof value !== 'string') return ''
  // 这里只做长度和 PostgREST 控制字符清理，不判断语义、不删中文主题词。
  return compact(value.replace(/[^\p{L}\p{N}\s_-]/gu, ' '), 48)
}

function parseResourcePlan(raw: string): Omit<TutorResourceSearchPlan, 'status'> | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[0]) as {
      shouldSearch?: unknown
      needsClarification?: unknown
      queries?: unknown
      resourceTypes?: unknown
      clarification?: unknown
    }
    if (typeof parsed.shouldSearch !== 'boolean') return null

    const queries = Array.isArray(parsed.queries)
      ? [...new Set(parsed.queries.map(safeQuery).filter(Boolean))].slice(0, 4)
      : []
    const requestedResourceTypes = Array.isArray(parsed.resourceTypes)
      ? (parsed.resourceTypes as unknown[])
      : []
    const resourceTypes = requestedResourceTypes.length
      ? TUTOR_RESOURCE_TYPES.filter((type) => requestedResourceTypes.includes(type))
      : [...TUTOR_RESOURCE_TYPES]

    const plan: Omit<TutorResourceSearchPlan, 'status'> = {
      shouldSearch: parsed.shouldSearch,
      queries,
      resourceTypes: resourceTypes.length ? resourceTypes : [...TUTOR_RESOURCE_TYPES],
    }
    const clarification = normalizeTutorResourceClarification(parsed.clarification)
    if (parsed.needsClarification === true && !clarification) {
      return null
    }
    // clarification 是可直接展示的结构化结果；即使模型的布尔摘要字段和它
    // 偶尔矛盾，也优先保留这个完整对象，避免把澄清问题静默变成普通回答。
    if (clarification) plan.clarification = clarification

    return plan
  } catch {
    return null
  }
}

function fallbackPlan(): TutorResourceSearchPlan {
  return {
    status: 'fallback',
    // 规划器不可用时保守降级：跳过本轮检索，避免故障时反而放大数据库压力。
    // system prompt 已约束「没有检索结果只能说暂时没查到」，失败不会被说成“站内没有”。
    shouldSearch: false,
    queries: [],
    resourceTypes: [...TUTOR_RESOURCE_TYPES],
  }
}

export async function planTutorResourceSearch(
  message: string,
  options?: {
    previousMessages?: TutorResourcePlannerHistoryMessage[]
    hasImages?: boolean
    hasCurrentLessonContext?: boolean
  },
): Promise<TutorResourceSearchPlan> {
  const fallback = fallbackPlan()
  if (!message.trim()) return fallback

  try {
    const previousMessages = (options?.previousMessages ?? [])
      .slice(-6)
      .map((item) => `${item.role === 'user' ? '学生' : '小迪'}：${compact(item.content, 240)}`)
      .join('\n')
    const plannerContent = [
      previousMessages ? `【最近对话（只用于理解“这个/那个”等指代）】\n${previousMessages}` : '',
      options?.hasImages ? '【当前消息包含图片：图片可能提供对象或任务上下文】' : '',
      options?.hasCurrentLessonContext ? '【当前会话已有当前课时/步骤上下文：“这一步”等指代可由场景确定】' : '',
      `【当前消息】\n${compact(message, 800)}`,
    ].filter(Boolean).join('\n\n')
    const plannerOptions = { modelMode: 'planner' as const, temperature: 0, maxTokens: 320 }
    const raw = await chatWithTutorComplete(
      RESOURCE_PLANNER_PROMPT,
      [{ role: 'user', content: plannerContent }],
      plannerOptions,
    )
    let parsed = parseResourcePlan(raw)

    // 偶发的截断/解释性前缀不应让清楚的请求静默走 fallback；只在协议解析失败
    // 时重试一次，语义判断仍完全交给 planner 模型。
    if (!parsed) {
      const retryRaw = await chatWithTutorComplete(
        `${RESOURCE_PLANNER_PROMPT}\n上一版输出没有通过 JSON 协议校验。请重新检查 needsClarification 与 clarification 是否一致，只输出完整的一行 JSON。`,
        [{ role: 'user', content: plannerContent }],
        plannerOptions,
      )
      parsed = parseResourcePlan(retryRaw)
    }

    return parsed ? { status: 'model', ...parsed } : fallback
  } catch {
    return fallback
  }
}

export function parseTutorResourceSearchPlanForTest(raw: string) {
  return parseResourcePlan(raw)
}
