import { describe, expect, it } from 'vitest'

import { buildScratchBlockHintKeywords } from '@/lib/courses/scratch-hints'

describe('buildScratchBlockHintKeywords', () => {
  it('extracts Scratch block keywords from the current lesson step', () => {
    expect(
      buildScratchBlockHintKeywords({
        step: {
          title: '点击效果',
          description: '点击元素时播放音乐或弹出祝福语。',
          hint: '「当角色被点击」加「播放声音」',
          checklist: [],
        },
      }),
    ).toEqual(['当角色被点击', '播放声音', '声音'])
  })

  it('falls back to required block labels when the step has no obvious keyword', () => {
    expect(
      buildScratchBlockHintKeywords({
        step: {
          title: '整理作品',
          description: '检查作品是否完整。',
          checklist: [],
        },
        lessonContent: {
          requiredBlocks: [
            { label: '重复执行', anyOf: ['control_forever'] },
            { label: '当绿旗被点击', anyOf: ['event_whenflagclicked'] },
          ],
        },
      }),
    ).toEqual(['重复执行', '当绿旗被点击'])
  })
})
