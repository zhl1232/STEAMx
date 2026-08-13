import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'

export const TUTOR_RESOURCE_TYPES = ['course', 'project'] as const
export type TutorResourceType = (typeof TUTOR_RESOURCE_TYPES)[number]

export type TutorResourceSearchPlan = {
  status: 'model' | 'fallback'
  shouldSearch: boolean
  /** 由模型从当前消息提取的 1-4 个主题短语；不是服务端关键词白名单。 */
  queries: string[]
  resourceTypes: TutorResourceType[]
}

export type TutorResourcePlannerHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

const RESOURCE_PLANNER_PROMPT = [
  '你是 STEAM 探索站内资源检索的规划器，不负责回答学生问题。',
  '请判断学生这句话是否可能是在寻找、比较、推荐或确认站内课程、课程课时、项目挑战或项目。',
  '只要有一点可能是在找站内资源就 shouldSearch=true；拿不准时也选 true，避免漏掉自然表达。只有明确的知识问答、当前课时操作指导、题目讲解、闲聊，且没有在找站内资源时才选 false。',
  '当前页面、当前课程和页面标题不能限制检索范围；学生可能在任意页面找任意课程或项目。',
  '如果 shouldSearch=true，提取 1-4 个最能定位资源的主题短语，例如作品名、物体、技能、学科、玩法或材料。学生用“这个/那个/更难的/类似的”等指代时，必须结合最近对话把指代还原成具体主题（例如上文在聊编程课，“更难一点的”应还原为“编程”“Scratch”）。每个短语必须独立可检索；不要把“课程/项目/有没有/推荐”等意图词或“更难一点”这类只有难度、指代的词当作主题短语。如果只是泛问“有什么课程/项目”，queries 可以为空。',
  '短语要拆到最小可检索单元：品牌、材料、年龄段等修饰词必须和主体名词分开输出，不要拼成一个长词。例如“乐高轮船”拆成「乐高」「轮船」，“纸板小车模型”拆成「纸板」「小车」。资源标题里通常只出现主体名词，拼接后的长词会一条都查不到。',
  'resourceTypes 只能填写 course、project；如果学生没有明确区分，两个都填。',
  '只输出一行 JSON，不要 Markdown、解释或回答。格式：{"shouldSearch":true,"queries":["主题短语"],"resourceTypes":["course","project"]}',
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
      queries?: unknown
      resourceTypes?: unknown
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

    return {
      shouldSearch: parsed.shouldSearch,
      queries,
      resourceTypes: resourceTypes.length ? resourceTypes : [...TUTOR_RESOURCE_TYPES],
    }
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
  options?: { previousMessages?: TutorResourcePlannerHistoryMessage[] },
): Promise<TutorResourceSearchPlan> {
  const fallback = fallbackPlan()
  if (!message.trim()) return fallback

  try {
    const previousMessages = (options?.previousMessages ?? [])
      .slice(-6)
      .map((item) => `${item.role === 'user' ? '学生' : '小迪'}：${compact(item.content, 240)}`)
      .join('\n')
    const raw = await chatWithTutorComplete(
      RESOURCE_PLANNER_PROMPT,
      [{
        role: 'user',
        content: [
          previousMessages ? `【最近对话（只用于理解“这个/那个”等指代）】\n${previousMessages}` : '',
          `【当前消息】\n${compact(message, 800)}`,
        ].filter(Boolean).join('\n\n'),
      }],
      { modelMode: 'planner', temperature: 0, maxTokens: 180 },
    )
    const parsed = parseResourcePlan(raw)
    return parsed ? { status: 'model', ...parsed } : fallback
  } catch {
    return fallback
  }
}

export function parseTutorResourceSearchPlanForTest(raw: string) {
  return parseResourcePlan(raw)
}
