import { describe, expect, it } from 'vitest'

import { parseBuildingVoiceCommand } from './building-voice-commands'

describe('parseBuildingVoiceCommand', () => {
  it.each([
    ['小迪，下一步。', 'next'],
    ['小迪下一页', 'next'],
    ['小迪，请上一步', 'previous'],
    ['小迪，请你上一页，谢谢！', 'previous'],
    [' 小迪 ： 麻烦你 暂停 。', 'pause'],
    ['小迪退出', 'exit'],
  ])('accepts the complete instruction %s', (transcript, command) => {
    expect(parseBuildingVoiceCommand(transcript)).toBe(command)
  })

  it.each([
    '',
    '下一步',
    '小弟下一步',
    '小迪不要下一步',
    '小迪不下一步',
    '小迪别下一步',
    '小迪不要暂停',
    '小迪下一步吗',
    '小迪下一步？',
    '小迪，下一步?',
    '小迪能不能下一步',
    '小迪下一步还是上一步',
    '小迪下一步，小迪上一页',
    '小迪下一步，然后暂停',
    '小迪下一步，我们先找一个零件',
    '宝宝下一步我们搭这个',
    '你说小迪下一步就会翻页',
    '“小迪下一步”',
    '小迪帮我解释下一步',
    '小迪下一步'.padEnd(81, ' '),
  ])('ignores ambiguous, negative, quoted or unrelated speech: %s', (transcript) => {
    expect(parseBuildingVoiceCommand(transcript)).toBeNull()
  })
})

import { selectBuildingKwsCommand, type BuildingKwsObservation } from './building-voice-commands'
const observed = (keyword = 'next'): BuildingKwsObservation => ({
  rejected: false, speechStart: 0.3, speechEnd: 1.5, duration: 2.16,
  hits: [{ keyword: 'wake', start_time: 0, tokens: Array(4).fill('token'), timestamps: [0.32, 0.4, 0.56, 0.64] }, { keyword, start_time: 0, tokens: Array(6).fill('token'), timestamps: [0.8, 0.92, 1.04, 1.16, 1.28, 1.4] }],
})
describe('acoustic KWS command gate (not full-text semantics)', () => {
  it.each([['next', 'next'], ['next_page', 'next'], ['previous', 'previous'], ['previous_page', 'previous'], ['pause', 'pause'], ['exit', 'exit']])('maps %s', (key, command) => {
    expect(selectBuildingKwsCommand(observed(key))).toBe(command)
  })
  it('accepts a pre-roll consonant alignment but rejects a late first vowel', () => {
    const match = observed()
    match.hits[0].timestamps = [0, 0.16, 0.36, 0.4]
    expect(selectBuildingKwsCommand(match)).toBe('next')
    match.hits[0].timestamps = [0, 0.84, 1, 1.08]
    expect(selectBuildingKwsCommand(match)).toBeNull()
  })
  it('rejects unknown, empty, negation/quotation veto and multiple or overlapping hits', () => {
    expect(selectBuildingKwsCommand(observed('unknown'))).toBeNull()
    expect(selectBuildingKwsCommand({ ...observed(), hits: [] })).toBeNull()
    expect(selectBuildingKwsCommand({ ...observed(), rejected: true })).toBeNull()
    expect(selectBuildingKwsCommand({ ...observed(), hits: [...observed().hits, ...observed('previous').hits] })).toBeNull()
    expect(selectBuildingKwsCommand({ ...observed(), hits: [...observed().hits, ...observed().hits] })).toBeNull()
  })
  it('rejects extra leading/trailing speech, incomplete wake phrases, nonfinite and truncated input', () => {
    expect(selectBuildingKwsCommand({ ...observed(), speechStart: 0 })).toBeNull()
    expect(selectBuildingKwsCommand({ ...observed(), speechEnd: 2 })).toBeNull()
    expect(selectBuildingKwsCommand({ ...observed(), duration: 5.1 })).toBeNull()
    expect(selectBuildingKwsCommand({ ...observed(), duration: NaN })).toBeNull()
    const partial = observed()
    partial.hits[0].timestamps = [0.3, 0.5]
    expect(selectBuildingKwsCommand(partial)).toBeNull()
  })
})
