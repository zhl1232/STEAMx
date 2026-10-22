import { describe, expect, it } from 'vitest'
import { selectBuildingAsrCommand, type BuildingAsrObservation } from './building-voice-asr'
const complete: BuildingAsrObservation = {
  text: '小迪 下一步', valid: true, speechStart: .3, speechEnd: 1.3, duration: 1.96,
  words: [{ word: '小迪', start: .21, end: .66 }, { word: '下一步', start: .66, end: 1.32 }],
}
describe('complete local ASR command', () => {
  it.each([['下一步', 'next'], ['下一页', 'next'], ['上一步', 'previous'], ['上一页', 'previous'], ['暂停', 'pause'], ['退出', 'exit']])('maps the complete %s phrase', (action, expected) => {
    expect(selectBuildingAsrCommand({ ...complete, text: `小迪 ${action}`, words: [complete.words[0], { ...complete.words[1], word: action }] })).toBe(expected)
  })
  it.each(['[unk] 小迪 退出', '小迪 [unk] 退出', '小迪 退出 [unk]', '小迪 不要 退出', '不要 小迪 退出', '老师说 小迪 退出', '小迪 退出 是 口令', '小迪 下一步 小迪 上一步'])('preserves and rejects extra text: %s', (text) => {
    expect(selectBuildingAsrCommand({ ...complete, text })).toBeNull()
  })
  it('rejects an omitted audible prefix even if ASR confidently returns a command', () => {
    expect(selectBuildingAsrCommand({ ...complete, words: [{ ...complete.words[0], start: .66, end: .99 }, { ...complete.words[1], start: .99, end: 1.56 }], speechEnd: 1.6, duration: 2.26 })).toBeNull()
  })
  it('rejects unexplained trailing speech, incomplete and malformed alignments', () => {
    expect(selectBuildingAsrCommand({ ...complete, speechEnd: 1.8, duration: 2.46 })).toBeNull()
    expect(selectBuildingAsrCommand({ ...complete, valid: false })).toBeNull()
    expect(selectBuildingAsrCommand({ ...complete, words: [] })).toBeNull()
    expect(selectBuildingAsrCommand({ ...complete, words: [{ ...complete.words[0], start: NaN }, complete.words[1]] })).toBeNull()
    expect(selectBuildingAsrCommand({ ...complete, words: [{ ...complete.words[0], word: '[unk]' }, complete.words[1]] })).toBeNull()
  })
})
