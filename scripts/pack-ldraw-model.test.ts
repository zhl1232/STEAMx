import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// 守护打包脚本的产物：duplo-car.mpd 必须是自洽的单文件（所有零件引用都已内联），
// 这样课时页用 LDrawLoader 加载时无需任何外部网络请求。
const MPD_PATH = resolve(process.cwd(), 'public/courses/ldraw/duplo-car.mpd')

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

describe('duplo-car.mpd 打包产物', () => {
  const text = readFileSync(MPD_PATH, 'utf8')
  const { fileNames, refs, stepCount } = parseMpd(text)

  it('主模型 duplo-car.ldr 在最前', () => {
    expect(text.startsWith('0 FILE duplo-car.ldr')).toBe(true)
  })

  it('包含 3 个搭建步骤（0 STEP）', () => {
    expect(stepCount).toBe(3)
  })

  it('每个零件引用都已内联，无外部依赖', () => {
    const missing = [...refs].filter((ref) => !fileNames.has(ref))
    expect(missing).toEqual([])
  })
})
