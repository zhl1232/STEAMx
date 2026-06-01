/**
 * 服务端解析 Scratch `.sb3` 作品（本质是 zip），提取所用积木的 opcode，
 * 用于「完成课时」时校验孩子是否用到了本课要求的关键积木。
 */
import { unzipSync, strFromU8 } from 'fflate'

import { detectSb3FromBytes } from '@/lib/utils/file-validation'
import type { LessonRequiredBlock } from '@/lib/courses/types'

interface Sb3Block {
  opcode?: string
}

interface Sb3Target {
  blocks?: Record<string, Sb3Block | unknown[]>
}

interface Sb3Project {
  targets?: Sb3Target[]
}

/**
 * 解出 sb3 里的 project.json，遍历所有角色/舞台的积木，收集 opcode 集合。
 * 解析失败（非法 zip、缺 project.json、JSON 损坏）时返回空集合，由调用方判定为未达成。
 */
export function extractOpcodesFromSb3(buffer: ArrayBuffer): Set<string> {
  const opcodes = new Set<string>()
  if (!detectSb3FromBytes(buffer)) return opcodes

  let files: Record<string, Uint8Array>
  try {
    // 只解出 project.json，跳过图片/音频等素材，省内存和 CPU
    files = unzipSync(new Uint8Array(buffer), {
      filter: (file) => file.name === 'project.json',
    })
  } catch {
    return opcodes
  }

  const projectFile = files['project.json']
  if (!projectFile) return opcodes

  let project: Sb3Project
  try {
    project = JSON.parse(strFromU8(projectFile)) as Sb3Project
  } catch {
    return opcodes
  }

  for (const target of project.targets ?? []) {
    const blocks = target.blocks
    if (!blocks || typeof blocks !== 'object') continue
    for (const block of Object.values(blocks)) {
      // 普通积木是对象 { opcode, ... }；变量/列表引用是数组，跳过
      if (block && !Array.isArray(block)) {
        const opcode = (block as Sb3Block).opcode
        if (typeof opcode === 'string') opcodes.add(opcode)
      }
    }
  }

  return opcodes
}

/**
 * 对照本课的 requiredBlocks 规则判断是否全部达成，返回未达成规则的中文 label 列表。
 * 每条规则满足 anyOf 中任一 opcode 即算达成。
 */
export function checkRequiredBlocks(
  opcodes: Set<string>,
  requiredBlocks: LessonRequiredBlock[],
): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  for (const rule of requiredBlocks) {
    const satisfied = rule.anyOf.some((op) => opcodes.has(op))
    if (!satisfied) missing.push(rule.label)
  }
  return { ok: missing.length === 0, missing }
}
