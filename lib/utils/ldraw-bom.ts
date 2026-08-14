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

/**
 * LDraw 英文零件描述 → 面向学员的中文名，如
 * `Duplo Brick  2 x  4` → `2×4 积木`；识别不了时保留英文描述。
 */
export function describeLdrawPartName(description: string): string {
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

function parseStepPartRefs(stepText: string): Array<{ partId: string; colorCode: number }> {
  const refs: Array<{ partId: string; colorCode: number }> = []

  for (const line of stepText.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/)
    if (tokens[0] !== '1' || tokens.length < 15) continue
    const colorCode = Number(tokens[1])
    refs.push({
      partId: normalizePartId(tokens.slice(14).join(' ')),
      colorCode: Number.isSafeInteger(colorCode) ? colorCode : -1,
    })
  }

  return refs
}

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

    for (const { partId, colorCode } of parseStepPartRefs(stepText)) {
      const { description, countable } = describe(partId)
      if (!countable) continue

      const key = `${partId}|${colorCode}`
      const color = colorTable?.get(colorCode)

      const stepEntry = stepEntries.get(key)
      if (stepEntry) stepEntry.count += 1
      else {
        stepEntries.set(key, {
          partId,
          partName: describeLdrawPartName(description) || partId,
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
