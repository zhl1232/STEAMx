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

  it('maps real course blocks across motion, sensing, data, operators, control, and music', () => {
    expect(
      buildScratchBlockHintItems({
        step: {
          title: '小游戏关键积木',
          description: [
            '[[block:motion|移到 x:0 y:-130]]',
            '[[block:sensing|按下 ← 键？]]',
            '[[block:variables|将 得分 增加 1]]',
            '[[block:operators|y 坐标 < -160]]',
            '[[block:control|停止 全部]]',
            '[[block:music|演奏音符 60 0.5 拍]]',
          ].join('，'),
          checklist: [],
        },
        maxItems: 6,
      }),
    ).toEqual([
      {
        label: '移到 x:0 y:-130',
        findLabel: '移到 x:0 y:-130',
        category: 'motion',
        blockIds: ['motion_gotoxy'],
      },
      {
        label: '按下 ← 键？',
        findLabel: '按下 ← 键？',
        category: 'sensing',
        blockIds: ['sensing_keypressed'],
      },
      {
        label: '将 得分 增加 1',
        findLabel: '将 得分 增加 1',
        category: 'data',
        blockIds: ['data_changevariableby'],
      },
      {
        label: 'y 坐标 < -160',
        findLabel: 'y 坐标 < -160',
        category: 'operators',
        blockIds: ['operator_lt'],
      },
      {
        label: '停止 全部',
        findLabel: '停止 全部',
        category: 'control',
        blockIds: ['control_stop'],
      },
      {
        label: '演奏音符 60 0.5 拍',
        findLabel: '演奏音符 60 0.5 拍',
        category: 'music',
        blockIds: ['music_playNoteForBeats'],
      },
    ])
  })

  it('uses the counted repeat opcode instead of the forever loop', () => {
    expect(
      buildScratchBlockHintItems({
        step: {
          title: '重复十次',
          description: '[[block:control|重复执行 10 次]]',
          checklist: [],
        },
      }),
    ).toEqual([
      {
        label: '重复执行 10 次',
        findLabel: '重复执行 10 次',
        category: 'control',
        blockIds: ['control_repeat'],
      },
    ])
  })

  it('maps expanded Scratch blocks used by richer lessons and projects', () => {
    expect(
      buildScratchBlockHintItems({
        step: {
          title: '进阶互动',
          description: [
            '[[block:motion|将 y 坐标设为 鼠标的 y 坐标]]',
            '[[block:looks|将大小设为 60]]',
            '[[block:looks|显示]]',
            '[[block:looks|隐藏]]',
            '[[block:sound|停止所有声音]]',
            '[[block:control|等待直到 碰到边缘？]]',
            '[[block:control|重复执行直到 得分 = 10]]',
            '[[block:control|建立克隆体 自己]]',
            '[[block:control|当作为克隆体启动时]]',
            '[[block:control|删除此克隆体]]',
            '[[block:pen|清空画笔]]',
            '[[block:pen|落笔]]',
            '[[block:pen|抬笔]]',
            '[[block:pen|将笔的大小设为 5]]',
          ].join('，'),
          checklist: [],
        },
        maxItems: 14,
      }),
    ).toEqual([
      {
        label: '将 y 坐标设为 鼠标的 y 坐标',
        findLabel: '将 y 坐标设为 0',
        category: 'motion',
        blockIds: ['motion_sety'],
        editHint: '把数值改成「鼠标的 y 坐标」',
      },
      {
        label: '将大小设为 60',
        findLabel: '将大小设为 100',
        category: 'looks',
        blockIds: ['looks_setsizeto'],
        editHint: '把大小改成「60」',
      },
      {
        label: '显示',
        findLabel: '显示',
        category: 'looks',
        blockIds: ['looks_show'],
      },
      {
        label: '隐藏',
        findLabel: '隐藏',
        category: 'looks',
        blockIds: ['looks_hide'],
      },
      {
        label: '停止所有声音',
        findLabel: '停止所有声音',
        category: 'sound',
        blockIds: ['sound_stopallsounds'],
      },
      {
        label: '等待直到 碰到边缘？',
        findLabel: '等待直到 碰到边缘？',
        category: 'control',
        blockIds: ['control_wait_until'],
      },
      {
        label: '重复执行直到 得分 = 10',
        findLabel: '重复执行直到 得分 = 10',
        category: 'control',
        blockIds: ['control_repeat_until'],
      },
      {
        label: '建立克隆体 自己',
        findLabel: '建立克隆体 自己',
        category: 'control',
        blockIds: ['control_create_clone_of'],
      },
      {
        label: '当作为克隆体启动时',
        findLabel: '当作为克隆体启动时',
        category: 'control',
        blockIds: ['control_start_as_clone'],
      },
      {
        label: '删除此克隆体',
        findLabel: '删除此克隆体',
        category: 'control',
        blockIds: ['control_delete_this_clone'],
      },
      {
        label: '清空画笔',
        findLabel: '清空画笔',
        category: 'pen',
        blockIds: ['pen_clear'],
      },
      {
        label: '落笔',
        findLabel: '落笔',
        category: 'pen',
        blockIds: ['pen_penDown'],
      },
      {
        label: '抬笔',
        findLabel: '抬笔',
        category: 'pen',
        blockIds: ['pen_penUp'],
      },
      {
        label: '将笔的大小设为 5',
        findLabel: '将笔的大小设为 1',
        category: 'pen',
        blockIds: ['pen_setPenSizeTo'],
        editHint: '把笔粗细改成「5」',
      },
    ])
  })

  it('maps newly added interaction and animation blocks kids reach for when stuck', () => {
    expect(
      buildScratchBlockHintItems({
        step: {
          title: '互动与动画积木',
          description: [
            '[[block:motion|滑行 1 秒到 x:100 y:50]]',
            '[[block:looks|移到最前面]]',
            '[[block:looks|前移 1 层]]',
            '[[block:looks|清除图形特效]]',
            '[[block:sound|将音量设为 60]]',
            '[[block:events|广播消息 开始 并等待]]',
            '[[block:sensing|回答]]',
            '[[block:sensing|鼠标的 x 坐标]]',
            '[[block:sensing|按下鼠标？]]',
            '[[block:sensing|响度]]',
            '[[block:sensing|计时器归零]]',
          ].join('，'),
          checklist: [],
        },
        maxItems: 11,
      }),
    ).toEqual([
      {
        label: '滑行 1 秒到 x:100 y:50',
        findLabel: '滑行 1 秒到 x:100 y:50',
        category: 'motion',
        blockIds: ['motion_glidesecstoxy'],
      },
      {
        label: '移到最前面',
        findLabel: '移到最前面',
        category: 'looks',
        blockIds: ['looks_gotofrontback'],
      },
      {
        label: '前移 1 层',
        findLabel: '前移 1 层',
        category: 'looks',
        blockIds: ['looks_goforwardbackwardlayers'],
      },
      {
        label: '清除图形特效',
        findLabel: '清除图形特效',
        category: 'looks',
        blockIds: ['looks_cleargraphiceffects'],
      },
      {
        label: '将音量设为 60',
        findLabel: '将音量设为 100%',
        category: 'sound',
        blockIds: ['sound_setvolumeto'],
        editHint: '把音量改成「60」',
      },
      {
        label: '广播消息 开始 并等待',
        findLabel: '广播消息 开始 并等待',
        category: 'events',
        blockIds: ['event_broadcastandwait'],
      },
      {
        label: '回答',
        findLabel: '回答',
        category: 'sensing',
        blockIds: ['sensing_answer'],
      },
      {
        label: '鼠标的 x 坐标',
        findLabel: '鼠标的 x 坐标',
        category: 'sensing',
        blockIds: ['sensing_mousex'],
      },
      {
        label: '按下鼠标？',
        findLabel: '按下鼠标？',
        category: 'sensing',
        blockIds: ['sensing_mousedown'],
      },
      {
        label: '响度',
        findLabel: '响度',
        category: 'sensing',
        blockIds: ['sensing_loudness'],
      },
      {
        label: '计时器归零',
        findLabel: '计时器归零',
        category: 'sensing',
        blockIds: ['sensing_resettimer'],
      },
    ])
  })

  it('splits think and ask blocks into a default toolbox form plus the edit to make', () => {
    expect(
      buildScratchBlockHintItems({
        step: {
          title: '思考与提问',
          description: ['[[block:looks|思考 让我想想 2 秒]]', '[[block:sensing|询问 你叫什么名字？ 并等待]]'].join('，'),
          checklist: [],
        },
        maxItems: 2,
      }),
    ).toEqual([
      {
        label: '思考 让我想想 2 秒',
        findLabel: '思考 嗯... 2 秒',
        category: 'looks',
        blockIds: ['looks_thinkforsecs'],
        editHint: '把文字改成「让我想想」',
      },
      {
        label: '询问 你叫什么名字？ 并等待',
        findLabel: '询问 你叫什么名字？ 并等待',
        category: 'sensing',
        blockIds: ['sensing_askandwait'],
        editHint: '把问题改成「你叫什么名字？」',
      },
    ])
  })

  it('maps word-based operator blocks without colliding with coordinates', () => {
    expect(
      buildScratchBlockHintItems({
        step: {
          title: '运算积木',
          description: ['[[block:operators|连接 苹果 和 香蕉]]', '[[block:operators|除以 3 的余数]]', '[[block:operators|四舍五入 3.6]]'].join('，'),
          checklist: [],
        },
        maxItems: 3,
      }),
    ).toEqual([
      {
        label: '连接 苹果 和 香蕉',
        findLabel: '连接 苹果 和 香蕉',
        category: 'operators',
        blockIds: ['operator_join'],
      },
      {
        label: '除以 3 的余数',
        findLabel: '除以 3 的余数',
        category: 'operators',
        blockIds: ['operator_mod'],
      },
      {
        label: '四舍五入 3.6',
        findLabel: '四舍五入 3.6',
        category: 'operators',
        blockIds: ['operator_round'],
      },
    ])
  })

  it('maps arithmetic and live-value reporter blocks used in game logic', () => {
    expect(
      buildScratchBlockHintItems({
        step: {
          title: '计算和角色状态',
          description: [
            '[[block:operators|5 + 3]]',
            '[[block:operators|10 - 2]]',
            '[[block:operators|4 * 6]]',
            '[[block:operators|24 / 3]]',
            '[[block:motion|x 坐标]]',
            '[[block:motion|y 坐标]]',
            '[[block:motion|方向]]',
            '[[block:looks|大小]]',
            '[[block:sound|音量]]',
          ].join('，'),
          checklist: [],
        },
        maxItems: 9,
      }),
    ).toEqual([
      {
        label: '5 + 3',
        findLabel: '5 + 3',
        category: 'operators',
        blockIds: ['operator_add'],
      },
      {
        label: '10 - 2',
        findLabel: '10 - 2',
        category: 'operators',
        blockIds: ['operator_subtract'],
      },
      {
        label: '4 * 6',
        findLabel: '4 * 6',
        category: 'operators',
        blockIds: ['operator_multiply'],
      },
      {
        label: '24 / 3',
        findLabel: '24 / 3',
        category: 'operators',
        blockIds: ['operator_divide'],
      },
      {
        label: 'x 坐标',
        findLabel: 'x 坐标',
        category: 'motion',
        blockIds: ['motion_xposition'],
      },
      {
        label: 'y 坐标',
        findLabel: 'y 坐标',
        category: 'motion',
        blockIds: ['motion_yposition'],
      },
      {
        label: '方向',
        findLabel: '方向',
        category: 'motion',
        blockIds: ['motion_direction'],
      },
      {
        label: '大小',
        findLabel: '大小',
        category: 'looks',
        blockIds: ['looks_size'],
      },
      {
        label: '音量',
        findLabel: '音量',
        category: 'sound',
        blockIds: ['sound_volume'],
      },
    ])
  })
})
