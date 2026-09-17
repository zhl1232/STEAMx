import { describe, expect, it } from 'vitest'

import {
  formatProjectDescriptionForDisplay,
  formatProjectStepDescriptionForDisplay,
  mergeBrokenParenMaterials,
} from './presentation'

describe('formatProjectDescriptionForDisplay', () => {
  const raw = [
    '【启蒙版·预览】',
    '科学原理：纸巾不会湿是因为杯子里有空气。',
    '演示视频（外链）：https://assets.steamx.cc/qimeng-preview/001_奇妙潜水艇/video_1.mp4',
    '来源：伙伴启蒙版实验（预览导入，可搜索标签「预览」「启蒙版」后删除）。',
  ].join('\n')

  it('softens banner/source and drops video line when player is shown', () => {
    expect(formatProjectDescriptionForDisplay(raw, { hasVideoPlayer: true })).toBe(
      [
        '科学原理：纸巾不会湿是因为杯子里有空气。',
        '来源：启蒙科学实验（预览）',
      ].join('\n'),
    )
  })

  it('keeps video line when no player', () => {
    const formatted = formatProjectDescriptionForDisplay(raw, { hasVideoPlayer: false })
    expect(formatted).toContain('演示视频（外链）：https://assets.steamx.cc/')
    expect(formatted).not.toContain('【启蒙版·预览】')
  })
})

describe('formatProjectStepDescriptionForDisplay', () => {
  it('strips leading demo-video marker when player is shown', () => {
    const raw =
      '【演示视频】https://assets.steamx.cc/qimeng-preview/001_奇妙潜水艇/video_1.mp4\n取三个量杯，装满清水。'
    expect(formatProjectStepDescriptionForDisplay(raw, { hasVideoPlayer: true })).toBe(
      '取三个量杯，装满清水。',
    )
  })
})

describe('mergeBrokenParenMaterials', () => {
  it('rejoins materials split inside full-width parentheses', () => {
    expect(mergeBrokenParenMaterials(['色素', '自备（纯牛奶', '洗洁精', '盘子）', '滴管'])).toEqual([
      '色素',
      '自备（纯牛奶、洗洁精、盘子）',
      '滴管',
    ])
  })

  it('leaves well-formed lists unchanged', () => {
    expect(mergeBrokenParenMaterials(['量杯7个', '滴管', '色素'])).toEqual([
      '量杯7个',
      '滴管',
      '色素',
    ])
  })
})
