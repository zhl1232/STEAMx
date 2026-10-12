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
