import { zipSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'

import { checkRequiredBlocks, extractOpcodesFromSb3 } from '@/lib/courses/scratch-validate'
import type { LessonRequiredBlock } from '@/lib/courses/types'

/** 把一个 project.json 对象打包成 .sb3（zip）字节，返回 ArrayBuffer。 */
function makeSb3(project: unknown): ArrayBuffer {
  const json = typeof project === 'string' ? project : JSON.stringify(project)
  const zipped = zipSync({ 'project.json': strToU8(json) })
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

describe('extractOpcodesFromSb3', () => {
  it('collects opcodes across every target in the project', () => {
    const buffer = makeSb3({
      targets: [
        { blocks: { a: { opcode: 'event_whenflagclicked' }, b: { opcode: 'motion_movesteps' } } },
        { blocks: { c: { opcode: 'looks_say' } } },
      ],
    })

    const opcodes = extractOpcodesFromSb3(buffer)

    expect(opcodes).toEqual(
      new Set(['event_whenflagclicked', 'motion_movesteps', 'looks_say']),
    )
  })

  it('de-dupes opcodes shared across blocks and targets', () => {
    const buffer = makeSb3({
      targets: [
        { blocks: { a: { opcode: 'motion_movesteps' }, b: { opcode: 'motion_movesteps' } } },
        { blocks: { c: { opcode: 'motion_movesteps' } } },
      ],
    })

    expect(extractOpcodesFromSb3(buffer)).toEqual(new Set(['motion_movesteps']))
  })

  it('skips variable/list references stored as arrays rather than block objects', () => {
    const buffer = makeSb3({
      targets: [
        {
          blocks: {
            realBlock: { opcode: 'data_setvariableto' },
            // 变量引用在 sb3 里是数组，不应被当成积木
            varRef: [12, 'score', 'var-id'],
          },
        },
      ],
    })

    expect(extractOpcodesFromSb3(buffer)).toEqual(new Set(['data_setvariableto']))
  })

  it('ignores blocks whose opcode is missing or not a string', () => {
    const buffer = makeSb3({
      targets: [
        {
          blocks: {
            good: { opcode: 'control_repeat' },
            noOpcode: { note: 'no opcode here' },
            badType: { opcode: 42 },
          },
        },
      ],
    })

    expect(extractOpcodesFromSb3(buffer)).toEqual(new Set(['control_repeat']))
  })

  it('returns an empty set for a target with no blocks', () => {
    const buffer = makeSb3({ targets: [{ blocks: {} }, {}] })
    expect(extractOpcodesFromSb3(buffer)).toEqual(new Set())
  })

  it('returns an empty set when the bytes are not a zip (missing PK signature)', () => {
    const notZip = toArrayBuffer(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))
    expect(extractOpcodesFromSb3(notZip)).toEqual(new Set())
  })

  it('returns an empty set when the buffer is too short to have a signature', () => {
    const tiny = toArrayBuffer(new Uint8Array([0x50, 0x4b]))
    expect(extractOpcodesFromSb3(tiny)).toEqual(new Set())
  })

  it('returns an empty set for a valid zip signature followed by corrupt zip data', () => {
    // 以 PK\x03\x04 开头骗过 detectSb3FromBytes，但后面不是合法 zip，unzipSync 应抛错被吞掉
    const corrupt = toArrayBuffer(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00]),
    )
    expect(extractOpcodesFromSb3(corrupt)).toEqual(new Set())
  })

  it('returns an empty set when the archive has no project.json', () => {
    const zipped = zipSync({ 'other.txt': strToU8('hello') })
    const buffer = toArrayBuffer(zipped)
    expect(extractOpcodesFromSb3(buffer)).toEqual(new Set())
  })

  it('returns an empty set when project.json is not valid JSON', () => {
    const buffer = makeSb3('{ not valid json ')
    expect(extractOpcodesFromSb3(buffer)).toEqual(new Set())
  })

  it('returns an empty set when the project has no targets array', () => {
    const buffer = makeSb3({ meta: { agent: 'test' } })
    expect(extractOpcodesFromSb3(buffer)).toEqual(new Set())
  })
})

describe('checkRequiredBlocks', () => {
  const rules: LessonRequiredBlock[] = [
    { label: '当绿旗被点击', anyOf: ['event_whenflagclicked'] },
    { label: '移动', anyOf: ['motion_movesteps', 'motion_gotoxy'] },
  ]

  it('passes when every rule is satisfied by at least one opcode', () => {
    const opcodes = new Set(['event_whenflagclicked', 'motion_gotoxy', 'looks_say'])
    expect(checkRequiredBlocks(opcodes, rules)).toEqual({ ok: true, missing: [] })
  })

  it('satisfies a rule when any one of its anyOf opcodes is present', () => {
    const opcodes = new Set(['event_whenflagclicked', 'motion_movesteps'])
    expect(checkRequiredBlocks(opcodes, rules)).toEqual({ ok: true, missing: [] })
  })

  it('reports the labels of unmet rules in declaration order', () => {
    const opcodes = new Set(['looks_say'])
    expect(checkRequiredBlocks(opcodes, rules)).toEqual({
      ok: false,
      missing: ['当绿旗被点击', '移动'],
    })
  })

  it('reports only the rules that are actually missing', () => {
    const opcodes = new Set(['motion_movesteps'])
    expect(checkRequiredBlocks(opcodes, rules)).toEqual({
      ok: false,
      missing: ['当绿旗被点击'],
    })
  })

  it('passes trivially when there are no required blocks', () => {
    expect(checkRequiredBlocks(new Set(), [])).toEqual({ ok: true, missing: [] })
  })

  it('fails against an empty opcode set when rules exist', () => {
    expect(checkRequiredBlocks(new Set(), rules)).toEqual({
      ok: false,
      missing: ['当绿旗被点击', '移动'],
    })
  })
})
