import { describe, expect, it } from 'vitest'

import {
  buildScratchBlockHintItems,
  buildScratchBlockHintKeywords,
  resolveScratchBlockCategory,
  stripScratchRichTextMarkers,
} from '@/lib/courses/scratch-hints'

describe('stripScratchRichTextMarkers', () => {
  it('converts lesson rich text markers into natural text for tutor context', () => {
    expect(
      stripScratchRichTextMarkers(
        '[[cat:events]] 的 [[block:events|当绿旗被点击]] → [[cat:looks]] 的 [[block:looks|说 出发啦！]]',
      ),
    ).toBe('事件分类的 当绿旗被点击（黄色事件帽子，带绿色小旗图标） → 外观分类的 说 你好!（把文字改成「出发啦！」）')
  })

  it('does not leak unknown rich text category keys', () => {
    expect(stripScratchRichTextMarkers('点 [[cat:unknown]]，拖 [[block:unknown|神秘积木]]')).toBe(
      '点 对应分类，拖 神秘积木',
    )
  })
})

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
    ).toEqual(['当角色被点击', '播放声音'])
  })

  it('extracts Scratch toolbox labels from lesson rich text markers', () => {
    expect(
      buildScratchBlockHintKeywords({
        step: {
          title: '出场说句话',
          description:
            '[[cat:events]] 的 [[block:events|当绿旗被点击]] → [[cat:looks]] 的 [[block:looks|说 出发啦！]]',
          checklist: [],
        },
      }),
    ).toEqual(['当绿旗被点击', '说 你好!'])
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
    expect(
      buildScratchBlockHintItems({
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
    ).toEqual([
      {
        label: '重复执行',
        findLabel: '重复执行',
        category: 'control',
        blockIds: ['control_forever'],
      },
      {
        label: '当绿旗被点击',
        findLabel: '当绿旗被点击',
        category: 'events',
        findHint: '黄色事件帽子，带绿色小旗图标',
        blockIds: ['event_whenflagclicked'],
      },
    ])
  })

  it('resolves a Scratch category when hinted keywords stay in one category', () => {
    expect(resolveScratchBlockCategory(['重复执行', '如果…那么'])).toBe('control')
    expect(resolveScratchBlockCategory(['播放声音'])).toBe('sound')
    expect(resolveScratchBlockCategory(['切换背景'])).toBe('looks')
    expect(resolveScratchBlockCategory(['没有映射的词'])).toBeUndefined()
  })

  it('does not choose a single category when one step uses blocks from multiple categories', () => {
    expect(resolveScratchBlockCategory(['当绿旗被点击', '说 你好!'])).toBeUndefined()
  })
})

describe('buildScratchBlockHintItems', () => {
  it('separates toolbox block labels from edits the child must make after dragging', () => {
    expect(
      buildScratchBlockHintItems({
        step: {
          title: '出场说句话',
          description:
            '[[cat:events]] 的 [[block:events|当绿旗被点击]] → [[cat:looks]] 的 [[block:looks|说 出发啦！]]',
          checklist: [],
        },
      }),
    ).toEqual([
      {
        label: '当绿旗被点击',
        findLabel: '当绿旗被点击',
        blockIds: ['event_whenflagclicked'],
        category: 'events',
        findHint: '黄色事件帽子，带绿色小旗图标',
      },
      {
        label: '说 出发啦！',
        findLabel: '说 你好!',
        blockIds: ['looks_say'],
        category: 'looks',
        editHint: '把文字改成「出发啦！」',
      },
    ])
  })
})
