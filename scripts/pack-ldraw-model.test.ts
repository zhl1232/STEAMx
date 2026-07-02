import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// 守护打包脚本的产物：课程 MPD 必须是自洽的单文件（所有零件引用都已内联），
// 这样课时页用 LDrawLoader 加载时无需任何外部网络请求。
const LDraw_DIR = resolve(process.cwd(), 'public/courses/ldraw')
const MPD_FILES = readdirSync(LDraw_DIR)
  .filter((file) => file.endsWith('.mpd'))
  .sort()

const EXPECTED_STEP_COUNTS: Record<string, number> = {
  '3-bao-jian.mpd': 14,
  '3-chang-jing-long.mpd': 12,
  '3-cheng-bao.mpd': 19,
  '3-cheng-qiang.mpd': 11,
  '3-chou-ti.mpd': 8,
  'duplo-car.mpd': 3,
  'eiffel-tower.mpd': 13,
  'preschool-bridge.mpd': 4,
  'preschool-car.mpd': 4,
  'preschool-crane.mpd': 4,
  'preschool-garden.mpd': 4,
  'preschool-gears.mpd': 4,
  'preschool-house.mpd': 4,
  'preschool-maze.mpd': 4,
  'preschool-park.mpd': 4,
  'preschool-ramp.mpd': 4,
  'preschool-seesaw.mpd': 4,
  'preschool-tower.mpd': 4,
  'preschool-windmill.mpd': 4,
}

// 复刻 LDrawLoader 解析 type-1 引用的同款变换（与 pack-ldraw-model.mjs 的 loaderKey 一致）。
function loaderKey(ref: string) {
  const normalized = ref.trim().replace(/\\/g, '/')
  if (normalized.startsWith('s/')) return `parts/${normalized}`
  if (normalized.startsWith('48/')) return `p/${normalized}`
  return normalized
}

function parseMpd(text: string) {
  const fileNames = new Set<string>()
  const refs = new Set<string>()
  let stepCount = 0

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('0 FILE ')) {
      fileNames.add(line.slice('0 FILE '.length).trim().toLowerCase())
      continue
    }
    if (line === '0 STEP') {
      stepCount++
      continue
    }
    if (line.startsWith('1 ')) {
      const tokens = line.split(/\s+/)
      if (tokens.length >= 15) {
        refs.add(loaderKey(tokens.slice(14).join(' ')).toLowerCase())
      }
    }
  }

  return { fileNames, refs, stepCount }
}

describe('LDraw MPD 打包产物', () => {
  it('所有课程模型都有明确的步骤数量预期', () => {
    expect(Object.keys(EXPECTED_STEP_COUNTS).sort()).toEqual(MPD_FILES)
  })

  it.each(MPD_FILES)('%s 主模型在最前、步骤数正确、无外部依赖', (file) => {
    const text = readFileSync(resolve(LDraw_DIR, file), 'utf8')
    const { fileNames, refs, stepCount } = parseMpd(text)
    const mainModel = file.replace(/\.mpd$/, '.ldr')
    const missing = [...refs].filter((ref) => !fileNames.has(ref))

    expect(text.startsWith(`0 FILE ${mainModel}`)).toBe(true)
    expect(stepCount).toBe(EXPECTED_STEP_COUNTS[file])
    expect(missing).toEqual([])
  })
})
