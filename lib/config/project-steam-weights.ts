import { getSteamWeights, type SteamWeights } from './subcategory-steam-weights'

const STEAM_DIMENSIONS = ['S', 'T', 'E', 'A', 'M'] as const
const MAX_DIMENSION_WEIGHT = 50
const MAX_TOTAL_WEIGHT = 70

type SteamDimension = typeof STEAM_DIMENSIONS[number]
type SteamAdjustment = Partial<Record<SteamDimension, number>>

interface SteamSignalRule {
  keywords: string[]
  weights: SteamAdjustment
}

interface SteamRebalanceRule {
  from: SteamDimension
  to: SteamDimension
  amount: number
  keywords: string[]
  categories?: string[]
}

export interface ProjectSteamStepInput {
  title?: string | null
  description?: string | null
}

export interface ProjectSteamInferenceInput {
  category?: string | null
  subCategory?: string | null
  title?: string | null
  description?: string | null
  tags?: string[] | null
  steps?: ProjectSteamStepInput[] | null
}

const CONTENT_SIGNAL_RULES: SteamSignalRule[] = [
  { keywords: ['声音传播', '声波', '振动传播'], weights: { S: 15, E: 5 } },
  { keywords: ['空气动力学', '升力', '风阻'], weights: { S: 15, E: 10 } },
  { keywords: ['承重', '结构稳定', '稳定性', '受力'], weights: { S: 10, E: 15, M: 10 } },
  { keywords: ['桥梁', '桁架', '拱桥', '悬索'], weights: { S: 5, E: 15, M: 10 } },
  { keywords: ['齿轮', '杠杆', '滑轮', '轮轴', '机械传动'], weights: { S: 5, T: 5, E: 15, M: 5 } },
  { keywords: ['电路', '传感器', '电机', '电压', '电流', '焊接'], weights: { S: 5, T: 15, E: 10 } },
  { keywords: ['机器人', '循迹', '机械臂', '遥控'], weights: { T: 12, E: 12, M: 5 } },
  { keywords: ['3d打印', '3d 建模', '切片', '建模'], weights: { T: 15, E: 10, A: 10 } },
  { keywords: ['编程', '程序', '代码', '算法'], weights: { T: 12, M: 8 } },
  { keywords: ['scratch', 'python', 'html', 'css', '网页'], weights: { T: 10, A: 5, M: 5 } },
  { keywords: ['动画', '故事', '角色', '贺卡'], weights: { A: 14, T: 4 } },
  { keywords: ['音乐', '乐曲', '节拍', '旋律', '音符'], weights: { T: 4, A: 14, M: 6 } },
  { keywords: ['画笔', '绘图', '图案', '万花筒', '构图', '色彩', '调色'], weights: { A: 12, M: 6 } },
  { keywords: ['雕塑', '泥塑', '陶土', '立体造型'], weights: { E: 8, A: 12 } },
  { keywords: ['观察', '调查', '记录', '样本', '分类', '图鉴'], weights: { S: 10, M: 5 } },
  { keywords: ['实验', '对比实验', '变量', '假设'], weights: { S: 12, M: 8 } },
  { keywords: ['测量', '数据', '统计', '坐标', '角度'], weights: { S: 5, M: 10 } },
  { keywords: ['几何', '对称', '拼图', '七巧板'], weights: { E: 4, A: 6, M: 12 } },
  { keywords: ['逻辑', '推理', '谜题', '迷宫', '排除'], weights: { E: 4, M: 14 } },
]

const CONTENT_REBALANCE_RULES: SteamRebalanceRule[] = [
  {
    from: 'T',
    to: 'A',
    amount: 10,
    categories: ['技术'],
    keywords: ['音乐', '动画', '故事', '贺卡', '网页', '主页', '设计', '画笔', '绘图', '图案'],
  },
  {
    from: 'T',
    to: 'M',
    amount: 5,
    categories: ['技术'],
    keywords: ['几何', '角度', '坐标', '排序', '算法', '逻辑'],
  },
  {
    from: 'A',
    to: 'S',
    amount: 10,
    categories: ['艺术'],
    keywords: ['实验', '观察', '声音传播', '空气动力学', '科学原理', '表面张力'],
  },
  {
    from: 'A',
    to: 'E',
    amount: 5,
    categories: ['艺术'],
    keywords: ['结构', '承重', '桥梁', '机械', '风筝', '纸杯电话'],
  },
  {
    from: 'M',
    to: 'A',
    amount: 5,
    categories: ['数学'],
    keywords: ['七巧板', '拼图', '对称', '图案', '几何'],
  },
  {
    from: 'M',
    to: 'E',
    amount: 5,
    categories: ['数学'],
    keywords: ['迷宫', '路径', '搭建'],
  },
]

function clampWeight(value: number) {
  return Math.min(MAX_DIMENSION_WEIGHT, Math.max(0, value))
}

function roundToNearestFive(value: number) {
  return Math.round(value / 5) * 5
}

function normalizeProjectText(input: ProjectSteamInferenceInput) {
  const fragments: string[] = []

  for (const value of [input.title, input.description, input.category, input.subCategory]) {
    if (typeof value === 'string' && value.trim()) {
      fragments.push(value.trim())
    }
  }

  for (const tag of input.tags || []) {
    if (typeof tag === 'string' && tag.trim()) {
      fragments.push(tag.trim())
    }
  }

  for (const step of input.steps || []) {
    if (typeof step?.title === 'string' && step.title.trim()) {
      fragments.push(step.title.trim())
    }
    if (typeof step?.description === 'string' && step.description.trim()) {
      fragments.push(step.description.trim())
    }
  }

  return fragments.join(' ').toLowerCase()
}

function applyAdjustment(weights: SteamWeights, adjustment: SteamAdjustment) {
  for (const dim of STEAM_DIMENSIONS) {
    if (typeof adjustment[dim] === 'number') {
      weights[dim] += adjustment[dim] ?? 0
    }
  }
}

function moveWeight(weights: SteamWeights, from: SteamDimension, to: SteamDimension, amount: number) {
  const transferable = Math.max(0, weights[from] - 5)
  const actual = Math.min(amount, transferable)

  if (actual <= 0) {
    return
  }

  weights[from] -= actual
  weights[to] += actual
}

function scaleWeights(weights: SteamWeights, nextTotal: number) {
  if (nextTotal <= MAX_TOTAL_WEIGHT) {
    return weights
  }

  const ratio = MAX_TOTAL_WEIGHT / nextTotal
  const scaled: SteamWeights = { S: 0, T: 0, E: 0, A: 0, M: 0 }

  for (const dim of STEAM_DIMENSIONS) {
    scaled[dim] = weights[dim] * ratio
  }

  return scaled
}

function finalizeWeights(weights: SteamWeights): SteamWeights {
  const clamped: SteamWeights = { S: 0, T: 0, E: 0, A: 0, M: 0 }

  for (const dim of STEAM_DIMENSIONS) {
    clamped[dim] = clampWeight(roundToNearestFive(weights[dim]))
  }

  return clamped
}

export function inferProjectSteamWeights(input: ProjectSteamInferenceInput): SteamWeights {
  const baseWeights = getSteamWeights(input.subCategory, input.category)
  const inferred: SteamWeights = { ...baseWeights }
  const text = normalizeProjectText(input)

  if (!text) {
    return inferred
  }

  let matchedSignalCount = 0

  for (const rule of CONTENT_SIGNAL_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      applyAdjustment(inferred, rule.weights)
      matchedSignalCount += 1
    }
  }

  if (matchedSignalCount === 0) {
    return inferred
  }

  for (const rule of CONTENT_REBALANCE_RULES) {
    const categoryMatches = !rule.categories?.length || rule.categories.includes(input.category || '')
    const keywordMatches = rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))

    if (categoryMatches && keywordMatches) {
      moveWeight(inferred, rule.from, rule.to, rule.amount)
    }
  }

  const total = STEAM_DIMENSIONS.reduce((sum, dim) => sum + inferred[dim], 0)
  return finalizeWeights(scaleWeights(inferred, total))
}
