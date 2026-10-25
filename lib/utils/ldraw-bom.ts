/**
 * 从打包 MPD 直接统计大颗粒课程的零件清单（BOM）。
 *
 * 模型里的 `0 STEP` 与 type-1 引用就是课时 3D 分步显隐的事实来源，
 * 因此每步零件数与全课总数都从模型算，不再依赖课时 content 里手写的
 * `parts` / `steps3d[].partIds`（历史课时大多为空）。
 */

import { buildEmbeddedLookup, splitMainModelSteps, splitPackedMpd } from '@/lib/utils/ldraw-mpd'

export interface LdrawColorInfo {
  name: string
  hex: string
}

export interface LdrawBomEntry {
  /** 规范化后的零件文件名，如 `3011.dat` */
  partId: string
  /** 面向学员/家长的中文零件名，如 `2×4 积木` */
  partName: string
  /** LDraw 官方英文零件描述，供老师核对 BOM */
  partDescription: string
  colorCode: number
  colorName: string
  colorHex: string
  count: number
  /** 此零件在模型中起连接作用（不是垫在最底下的底板），即使形状是底板也必须备齐 */
  structural?: boolean
}

export interface LdrawBomStep {
  stepIndex: number
  /** 这一步新增的零件总块数 */
  partCount: number
  entries: LdrawBomEntry[]
}

export interface LdrawBom {
  stepCount: number
  /** 整个作品的零件总块数 */
  partCount: number
  /** 零件种类数（按零件 + 颜色区分） */
  kindCount: number
  steps: LdrawBomStep[]
  /** 全模型汇总，按数量降序 */
  entries: LdrawBomEntry[]
}

const FALLBACK_COLOR_HEX = '#94a3b8'
const MOVED_ALIAS_PATTERN = /^~moved to\s+(\S+)/i
const MAX_ALIAS_HOPS = 4

/** 解析 LDConfig.ldr 的 `0 !COLOUR` 行，得到色号 → 名称/色值。 */
export function parseLdrawColorTable(ldConfigText: string): Map<number, LdrawColorInfo> {
  const table = new Map<number, LdrawColorInfo>()

  for (const line of ldConfigText.split(/\r?\n/)) {
    const match = line.match(/^0 !COLOUR\s+(\S+)\s+CODE\s+(\d+)\s+VALUE\s+(#[0-9A-Fa-f]{6})/)
    if (!match) continue
    const code = Number(match[2])
    if (!Number.isSafeInteger(code) || table.has(code)) continue
    table.set(code, { name: match[1], hex: match[3].toUpperCase() })
  }

  return table
}

const COLOR_BASE_NAMES: Readonly<Record<string, string>> = {
  black: '黑色',
  blue: '蓝色',
  green: '绿色',
  red: '红色',
  brown: '棕色',
  grey: '灰色',
  gray: '灰色',
  white: '白色',
  yellow: '黄色',
  orange: '橙色',
  lime: '黄绿色',
  purple: '紫色',
  violet: '紫色',
  pink: '粉色',
  magenta: '洋红色',
  tan: '米色',
  turquoise: '青色',
  cyan: '青色',
  azure: '天蓝色',
  gold: '金色',
  silver: '银色',
  olive: '橄榄绿',
  sand: '沙色',
  lavender: '淡紫色',
  maroon: '栗色',
}

// 一个颜色最多带一个中文修饰词，避免出现「亮浅蓝色」这种拗口叠加。
const COLOR_MODIFIERS: ReadonlyArray<readonly [string, string]> = [
  ['trans', '透明'],
  ['light', '浅'],
  ['dark', '深'],
  ['bright', '亮'],
  ['medium', '中'],
  ['neon', '荧光'],
  ['pearl', '珠光'],
  ['metallic', '金属'],
]

/** LDraw 英文色名 → 中文色名；无法识别时回退英文。 */
export function describeLdrawColorName(englishName: string): string {
  const tokens = englishName.toLowerCase().split(/[_\s-]+/).filter(Boolean)
  const baseToken = [...tokens].reverse().find((token) => COLOR_BASE_NAMES[token])
  if (!baseToken) return englishName.replace(/_/g, ' ')

  const modifier = COLOR_MODIFIERS.find(([token]) => tokens.includes(token))?.[1] ?? ''
  return `${modifier}${COLOR_BASE_NAMES[baseToken]}`
}

// 顺序敏感：先匹配更具体的类别（如 car base 早于 brick）。
const PART_CATEGORIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/car base/i, '车底盘'],
  [/baseplate/i, '底板'],
  [/ball tube/i, '滚球管'],
  [/door frame/i, '门框'],
  [/\bdoors?\b/i, '门'],
  [/\bwindows?\b/i, '窗户'],
  [/\bfence\b/i, '栅栏'],
  [/\barch\b/i, '拱形积木'],
  [/flagpole|antenna/i, '旗杆'],
  [/\bflag\b/i, '旗子'],
  [/\bfigure\b/i, '人物'],
  [/flower|\bplant\b/i, '花草'],
  [/\btiles?\b/i, '光滑板'],
  [/\bplates?\b/i, '薄板'],
  [/\bbricks?\b/i, '积木'],
  [/\bwheels?\b/i, '车轮'],
  [/\bball\b/i, '球'],
  [/\bslope\b/i, '斜坡积木'],
  [/turntable/i, '转盘'],
  [/\bhinge\b/i, '铰链件'],
  [/\bdisc\b/i, '圆片'],
]

const SCALE_SENSITIVE_CATEGORIES = new Set(['积木', '薄板', '底板', '光滑板', '斜坡积木'])

const PART_MODIFIERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/curved top/i, '弧顶'],
  [/rounded ends?/i, '圆角'],
  [/\beyes?\b/i, '眼睛'],
  [/with (?:yellow )?wheels/i, '带轮'],
  [/tube holder/i, '带管座'],
  [/\bexit\b/i, '出口'],
  [/45 degrees?/i, '45°'],
  [/\bstraight\b/i, '直管'],
  [/stripes?/i, '条纹'],
  [/with cap/i, '戴帽子'],
  [/\bhinge\b/i, '铰链'],
]

function cleanPartDescription(description: string): string {
  return description.replace(/^[~=_]+/, '').trim()
}

// 课程 5/6/7 的特殊零件：按零件号命名，避免本地几何描述或通用类别误导家长。
const PART_NAMES_ZH: Readonly<Record<string, string>> = {
  '58629pb02': '搅拌筒（红条纹）',
  '95219c01': '搅拌筒底座',
  '71059-helicopter-small-formed-approx': '传动皮带',
  '71059-helicopter-large-formed-approx': '传动皮带',
  '71059-measuring-wheel-formed-approx': '传动皮带',
  'rotor-left-small-formed': '自备细绳（示意）',
  'rotor-left-large-formed': '自备细绳（示意）',
  'rotor-right-small-formed': '自备细绳（示意）',
  'rotor-right-large-formed': '自备细绳（示意）',
  '61898d-hovercraft-formed': '矩形软片（船裙）',
  '76395': '4×6 螺丝积木',
  '76395-001': '4×6 螺丝积木',
  '76395-010': '4×6 螺丝积木',
  '76395-010-p010': '4×6 螺丝积木',
  '76395-011': '4×6 螺丝积木',
  '76395-100': '4×6 螺丝积木',
  '76395-100-p100': '4×6 螺丝积木',
  '76395-110': '4×6 螺丝积木',
  '76395-001-p001': '4×6 螺丝积木',
  '76395-110-p110': '4×6 螺丝积木',
  '76395-110-phase01': '4×6 螺丝积木',
  '76395-110-phase10': '4×6 螺丝积木',
  '76057': '2×4 螺丝积木',
  '28336': '2×2 叉臂螺丝积木',
  '28334': '短连杆',
  '28331': '长连杆',
  '74957': '2×2 卡扣螺丝积木',
  '99565': '螺丝轮毂',
  '44970': '越野轮胎',
  '60535': '旋转底座',
  '71981': '履带',
  '6294': '铲斗',
  '6310': '三齿铲斗',
  '14094': '翻斗车斗',
  '2223': '梯子支架',
  '31239c01': '尾翼',
  '4433c01': '排气管',
  '4433c01-shou-ge-ji': '排气管',
  '45146-shou-ge-ji': '挡风护架',
  '6295-ta-diao': '带吊钩起重臂',
  '6669c01': '小号三叶螺旋桨',
  '6670c01': '大号三叶螺旋桨',
  '61898b': '13×26 塑料片螺旋桨',
  '61898bc01': '13×26 塑料片螺旋桨（成形）',
  '61898cc01': '18×66 塑料片螺旋桨（成形）',
  '61898dc01': '24×25 塑料片船帆（成形）',
  '61898ec01': '11×25 塑料片船帆（成形）',
  '4663': '带横杆短吊钩',
  '31196c01': '驾驶舱',
  '31196c01-wheelarch': '驾驶舱',
  '31196c01-fourwheel': '驾驶舱',
  '31196c01-qst': '驾驶舱',
  '6345': '弧形挡风玻璃',
  '6521': '8 格轴',
  '6522': '6 格轴',
  '6523': '5 格齿轮轴',
  '6525': '11 孔梁',
  '6524': '7 孔梁',
  '6526': '摇把',
  '14013c01': '卷筒（含绳索和长吊钩）',
  '13358': '起重机卷筒支架',
  '6527': '皮带轮',
  '75536': '卷线轮（带绳和吊钩）',
  '6529': '24 齿齿轮',
  '6530': '40 齿齿轮',
  '31622': '冠齿轮',
  '31623': '8 格轴（带 8 齿齿轮）',
  '31624': '齿轮箱',
  '31625': '蜗杆',
  '6292': '轮胎',
  '75349': '2×4 带孔积木',
  '6517': '2×4 带孔积木',
  '75350': '2×10 带孔积木',
  '6515': '2×10 带孔积木',
  '31193': '滚球管小门',
  '31453': '2×6 带翼积木',
  '13355': '2×2 活动连接板',
  '6474': '2×2 斜坡积木',
  '47198p03': '小人手臂',
  '47199': '小人帽子',
  '47203p03': '小人上身',
  '47204': '小人腰部',
  '47205': '小人腿部',
  '47206p01': '小人头部',
  '47207': '小人连接棒',
  '31111p02': '长颈鹿腿部积木',
  '31111p03': '长颈鹿身体积木',
  '31111p04': '长颈鹿头部积木',
  '31111p05': '老虎腿部积木',
  '31111p06': '老虎身体积木',
  '31111p07': '老虎头部积木',
  '31111p08': '鳄鱼腿部积木',
  '31111p09': '鳄鱼身体积木',
  '31111p0a': '鳄鱼头部积木',
  '31111p0b': '火烈鸟腿部积木',
  '31111p0c': '火烈鸟身体积木',
  '31111p0d': '火烈鸟头部积木',
  '31111p0e': '斑马腿部积木',
  '31111p0f': '斑马身体积木',
  '31111p0g': '斑马头部积木',
}

/**
 * LDraw 英文零件描述 → 面向学员的中文名，如
 * `Duplo Brick  2 x  4` → `2×4 积木`；优先查零件号表，其余保留通用描述器。
 */
export function describeLdrawPartName(description: string, partId?: string): string {
  const id = partId ? normalizePartId(partId).replace(/\.dat$/, '') : ''
  if (Object.hasOwn(PART_NAMES_ZH, id)) return PART_NAMES_ZH[id]

  const cleaned = cleanPartDescription(description)
  if (!cleaned) return ''

  const category = PART_CATEGORIES.find(([pattern]) => pattern.test(cleaned))?.[1]
  if (!category) return cleaned

  const dimensions = cleaned.match(/(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?/i)
  const size = dimensions
    ? [dimensions[1], dimensions[2], dimensions[3]].filter(Boolean).join('×')
    : ''

  const modifier = PART_MODIFIERS.find(
    ([pattern, label]) => label !== category && pattern.test(cleaned),
  )?.[1]

  // 非 Duplo 的砖/板要标出小颗粒（如埃菲尔铁塔用到的 32×32 底板），
  // 其余类别（球、人物等）本身没有大小歧义，不加前缀免得读起来别扭。
  const scale =
    !/duplo/i.test(cleaned) && SCALE_SENSITIVE_CATEGORIES.has(category) ? '小颗粒' : ''
  const suffix = modifier ? `（${modifier}）` : ''

  return `${[size, `${scale}${category}`].filter(Boolean).join(' ')}${suffix}`
}

function normalizePartId(reference: string): string {
  return reference.trim().replace(/\\/g, '/').toLowerCase().split('/').pop() ?? reference
}

interface LdrawPartInfo {
  description: string
  /** 是否算作一块可拿取的零件；LDraw 图元/子件只是零件内部几何。 */
  countable: boolean
}

/** 取内联零件块的描述行与 `!LDRAW_ORG` 类型。 */
function readPartBlock(blockText: string): LdrawPartInfo {
  let description = ''
  let ldrawOrg = ''

  for (const line of blockText.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (!trimmed.startsWith('0 ')) break
    const rest = trimmed.slice(2).trim()
    if (!rest) continue

    const org = rest.match(/^!LDRAW_ORG\s+(\S+)/)
    if (org) {
      ldrawOrg = org[1]
      continue
    }
    if (/^(!|\/\/|Name:|Author:|BFC\b)/.test(rest)) continue
    if (!description) description = rest
  }

  return {
    description,
    countable: !/primitive|subpart/i.test(ldrawOrg),
  }
}

function resolvePartInfo(lookup: Map<string, string>, partId: string): LdrawPartInfo {
  let currentId = partId

  for (let hop = 0; hop < MAX_ALIAS_HOPS; hop += 1) {
    const block = lookup.get(currentId)
    if (!block) return { description: '', countable: true }

    const info = readPartBlock(block)
    // `~Moved to 2301b` 之类的迁移占位块本身没有可读名字，跟一跳到新零件。
    const movedTo = info.description.match(MOVED_ALIAS_PATTERN)?.[1]
    if (!movedTo) return info

    const nextId = normalizePartId(movedTo.endsWith('.dat') ? movedTo : `${movedTo}.dat`)
    if (nextId === currentId) return info
    currentId = nextId
  }

  return { description: '', countable: true }
}

interface LdrawBomPartReference {
  partId: string
  colorCode: number
  reference: string
}

function parseStepPartRefs(stepText: string): LdrawBomPartReference[] {
  const refs: LdrawBomPartReference[] = []

  for (const line of stepText.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/)
    if (tokens[0] !== '1' || tokens.length < 15) continue
    const colorCode = Number(tokens[1])
    refs.push({
      partId: normalizePartId(tokens.slice(14).join(' ')),
      colorCode: Number.isSafeInteger(colorCode) ? colorCode : -1,
      reference: tokens.join(' '),
    })
  }

  return refs
}

// 旧电梯 MPD 将 75536 的两个附属吊钩误标为普通 Part。仅识别已核对的
// 第 9 步相邻组合引用；其它模型、独立吊钩和已改过的位置均照常计数。
// 新模型应使用 s/steamx-75536-hook.dat（Subpart），无需此兼容规则。
const ELEVATOR_ASSEMBLY_HOOKS = new Map([
  [
    '1 14 -318 -508.99975 -30 1 0 0 0 1 0 0 0 1 4663.dat',
    '1 14 -320 -864 -20 1 0 0 0 1 0 0 0 1 75536.dat',
  ],
  [
    '1 14 322 -508.99975 -30 1 0 0 0 1 0 0 0 1 4663.dat',
    '1 14 320 -864 -20 1 0 0 0 1 0 0 0 1 75536.dat',
  ],
])

function sortEntries(entries: LdrawBomEntry[]): LdrawBomEntry[] {
  return entries.sort(
    (a, b) =>
      b.count - a.count ||
      a.partName.localeCompare(b.partName, 'zh-Hans-CN') ||
      a.colorCode - b.colorCode,
  )
}

/**
 * 统计打包 MPD 的分步零件清单。
 * `colorTable` 缺省时颜色名回退为色号，不影响数量统计。
 */
export function summarizePackedLdrawBom(
  mpdText: string,
  colorTable?: Map<number, LdrawColorInfo>,
): LdrawBom {
  const { mainText, embedded } = splitPackedMpd(mpdText)
  const lookup = buildEmbeddedLookup(embedded)
  const { steps } = splitMainModelSteps(mainText)
  const hasLegacyElevatorHooks = /^0 Name: 5-sheng-jiang-dian-ti\.ldr\s*$/m.test(mainText)

  const partInfoCache = new Map<string, LdrawPartInfo>()
  const describe = (partId: string) => {
    const cached = partInfoCache.get(partId)
    if (cached) return cached
    const info = resolvePartInfo(lookup, partId)
    partInfoCache.set(partId, info)
    return info
  }

  const totals = new Map<string, LdrawBomEntry>()
  const bomSteps: LdrawBomStep[] = steps.map((stepText, stepIndex) => {
    const stepEntries = new Map<string, LdrawBomEntry>()
    const refs = parseStepPartRefs(stepText)

    for (const [index, { partId, colorCode, reference }] of refs.entries()) {
      if (
        hasLegacyElevatorHooks && stepIndex === 8 && index > 0 &&
        ELEVATOR_ASSEMBLY_HOOKS.get(reference) === refs[index - 1].reference
      ) continue
      const { description, countable } = describe(partId)
      if (!countable) continue

      const key = `${partId}|${colorCode}`
      const color = colorTable?.get(colorCode)

      const stepEntry = stepEntries.get(key)
      if (stepEntry) stepEntry.count += 1
      else {
        stepEntries.set(key, {
          partId,
          partName: describeLdrawPartName(description, partId) || partId,
          partDescription: cleanPartDescription(description),
          colorCode,
          colorName: color ? describeLdrawColorName(color.name) : `色号 ${colorCode}`,
          colorHex: color?.hex ?? FALLBACK_COLOR_HEX,
          count: 1,
        })
      }

      const total = totals.get(key)
      if (total) total.count += 1
      else totals.set(key, { ...stepEntries.get(key)!, count: 1 })
    }

    const entries = sortEntries([...stepEntries.values()])
    return {
      stepIndex,
      partCount: entries.reduce((sum, entry) => sum + entry.count, 0),
      entries,
    }
  })

  const entries = sortEntries([...totals.values()])
  return {
    stepCount: bomSteps.length,
    partCount: entries.reduce((sum, entry) => sum + entry.count, 0),
    kindCount: entries.length,
    steps: bomSteps,
    entries,
  }
}
