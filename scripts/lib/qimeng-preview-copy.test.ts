import { describe, expect, it } from 'vitest'

import {
  applyQimengPreviewCopyCleanup,
  cleanQimengDescription,
  cleanQimengStepDescription,
  cleanQimengTags,
  cleanQimengTitle,
  isDuplicateQimengReflection,
  isQimengSourceTag,
} from './qimeng-preview-copy.mjs'

describe('qimeng preview copy cleanup', () => {
  const rawDescription = [
    '【启蒙版·预览】',
    '科学原理：纸巾不会湿是因为杯子里有空气。',
    '演示视频（外链）：https://assets.steamx.cc/qimeng-preview/001_奇妙潜水艇/video_1.mp4',
    '来源：伙伴启蒙版实验（预览导入，可搜索标签「预览」「启蒙版」后删除）。',
  ].join('\n')

  it('strips the 【预览】 title prefix', () => {
    expect(cleanQimengTitle('【预览】调色大师')).toBe('调色大师')
    expect(cleanQimengTitle('调色大师')).toBe('调色大师')
  })

  it('drops preview banner, source boilerplate, and duplicate video URL lines', () => {
    expect(cleanQimengDescription(rawDescription)).toBe('科学原理：纸巾不会湿是因为杯子里有空气。')
  })

  it('strips the demo-video prefix from a step body', () => {
    expect(
      cleanQimengStepDescription(
        '【演示视频】https://assets.steamx.cc/qimeng-preview/001_奇妙潜水艇/video_1.mp4\n取三个量杯，装满清水。',
      ),
    ).toBe('取三个量杯，装满清水。')
  })

  it('removes 预览 but keeps 启蒙版 and qimeng-src:*', () => {
    expect(cleanQimengTags(['启蒙版', '预览', 'qimeng-src:1071409', '科学实验'])).toEqual([
      '启蒙版',
      'qimeng-src:1071409',
      '科学实验',
    ])
    expect(isQimengSourceTag('qimeng-src:1071409')).toBe(true)
  })

  it('treats principle-only reflection as a duplicate of description', () => {
    expect(
      isDuplicateQimengReflection(
        '【启蒙版·预览】科学原理补充：纸巾不会湿是因为杯子里有空气。',
        '科学原理：纸巾不会湿是因为杯子里有空气。',
      ),
    ).toBe(true)
  })

  it('applies the full project-row transform', () => {
    const cleaned = applyQimengPreviewCopyCleanup({
      title: '【预览】奇妙潜水艇',
      description: rawDescription,
      reflection: '【启蒙版·预览】科学原理补充：纸巾不会湿是因为杯子里有空气。',
      tags: ['启蒙版', '预览', 'qimeng-src:1', '幼儿科学'],
      problem_statement: '【启蒙版·预览】伙伴启蒙版实验预览导入；sourceId=1; folder=001_奇妙潜水艇',
    })
    expect(cleaned).toEqual({
      title: '奇妙潜水艇',
      description: '科学原理：纸巾不会湿是因为杯子里有空气。',
      reflection: '',
      tags: ['启蒙版', 'qimeng-src:1', '幼儿科学'],
      problem_statement: 'sourceId=1; folder=001_奇妙潜水艇',
    })
  })
})
