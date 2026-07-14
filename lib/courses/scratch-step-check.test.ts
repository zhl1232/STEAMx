import { describe, expect, it } from 'vitest'

import {
  buildScratchStepCheck,
  evaluateScratchStepItems,
  filterScratchBlockItemsByExistingBlocks,
} from '@/lib/courses/scratch-step-check'
import type { ScratchEditorContext } from '@/lib/courses/scratch-messages'

describe('evaluateScratchStepItems', () => {
  it('keeps all Scratch step items pending until the editor context is available', () => {
    const result = evaluateScratchStepItems({
      items: [
        {
          label: '当绿旗被点击',
          findLabel: '当绿旗被点击',
          blockIds: ['event_whenflagclicked'],
        },
      ],
      editorContext: null,
    })

    expect(result.status).toBe('unknown')
    expect(result.reason).toBe('no_editor_context')
    expect(result.nextTargetItemIndex).toBe(0)
  })

  it('marks opcode-only Scratch actions complete when their opcode exists on the selected target', () => {
    const context: ScratchEditorContext = {
      selectedTargetId: 'cat',
      selectedTargetName: 'Cat',
      targets: [
        {
          id: 'cat',
          name: 'Cat',
          blocks: [{ id: 'hat', type: 'event_whenflagclicked' }],
        },
      ],
    }

    const result = evaluateScratchStepItems({
      items: [
        {
          label: '当绿旗被点击',
          findLabel: '当绿旗被点击',
          blockIds: ['event_whenflagclicked'],
        },
      ],
      editorContext: context,
    })

    expect(result.status).toBe('complete')
    expect(result.completeCount).toBe(1)
  })

  it('checks editable Scratch text against serialized block inputs', () => {
    const context: ScratchEditorContext = {
      selectedTargetId: 'cat',
      selectedTargetName: 'Cat',
      targets: [
        {
          id: 'cat',
          name: 'Cat',
          blocks: [
            {
              id: 'say',
              type: 'looks_say',
              inputs: {
                MESSAGE: [1, [10, '出发啦！']],
              },
            },
          ],
        },
      ],
    }

    const result = evaluateScratchStepItems({
      items: [
        {
          label: '说 出发啦！',
          findLabel: '说 你好!',
          blockIds: ['looks_say'],
          editHint: '把文字改成「出发啦！」',
        },
      ],
      editorContext: context,
    })

    expect(result.status).toBe('complete')
    expect(result.items[0]?.detail).toContain('匹配')
  })

  it('does not treat matching opcodes as complete when editable values differ', () => {
    const context: ScratchEditorContext = {
      selectedTargetId: 'cat',
      selectedTargetName: 'Cat',
      targets: [
        {
          id: 'cat',
          name: 'Cat',
          blocks: [
            {
              id: 'say',
              type: 'looks_say',
              inputs: {
                MESSAGE: [1, [10, '你好!']],
              },
            },
          ],
        },
      ],
    }

    const result = evaluateScratchStepItems({
      items: [
        {
          label: '说 出发啦！',
          findLabel: '说 你好!',
          blockIds: ['looks_say'],
          editHint: '把文字改成「出发啦！」',
        },
      ],
      editorContext: context,
    })

    expect(result.status).toBe('needs_work')
    expect(result.items[0]).toMatchObject({
      status: 'needs_edit',
      originalIndex: 0,
    })
  })

  it('keeps the pending target index aligned to the original step item', () => {
    const context: ScratchEditorContext = {
      selectedTargetId: 'cat',
      selectedTargetName: 'Cat',
      targets: [
        {
          id: 'cat',
          name: 'Cat',
          blocks: [{ id: 'hat', type: 'event_whenflagclicked' }],
        },
      ],
    }

    const filtered = filterScratchBlockItemsByExistingBlocks(
      [
        {
          label: '当绿旗被点击',
          findLabel: '当绿旗被点击',
          blockIds: ['event_whenflagclicked'],
        },
        {
          label: '说 出发啦！',
          findLabel: '说 你好!',
          blockIds: ['looks_say'],
          editHint: '把文字改成「出发啦！」',
        },
      ],
      context,
    )

    expect(filtered.existingItems.map((item) => item.findLabel)).toEqual(['当绿旗被点击'])
    expect(filtered.pendingItems.map((item) => item.findLabel)).toEqual(['说 你好!'])
    expect(filtered.pendingOriginalIndexes).toEqual([1])
  })
})

describe('buildScratchStepCheck', () => {
  it('asks the learner to review connections when ordered step blocks are not connected', () => {
    const result = buildScratchStepCheck({
      step: {
        title: '出场说句话',
        description:
          '[[cat:events]] 的 [[block:events|当绿旗被点击]] → [[cat:looks]] 的 [[block:looks|说 出发啦！]]',
        checklist: [],
      },
      editorContext: {
        selectedTargetId: 'cat',
        selectedTargetName: 'Cat',
        targets: [
          {
            id: 'cat',
            name: 'Cat',
            blocks: [
              { id: 'hat', type: 'event_whenflagclicked' },
              {
                id: 'say',
                type: 'looks_say',
                inputs: { MESSAGE: [1, [10, '出发啦！']] },
              },
            ],
          },
        ],
      },
    })

    expect(result.status).toBe('needs_work')
    expect(result.items[1]).toMatchObject({
      status: 'needs_review',
      originalIndex: 1,
    })
    expect(result.items[1]?.detail).toContain('拼在一起')
  })

  it('passes ordered step blocks when they are connected in the same stack', () => {
    const result = buildScratchStepCheck({
      step: {
        title: '出场说句话',
        description:
          '[[cat:events]] 的 [[block:events|当绿旗被点击]] → [[cat:looks]] 的 [[block:looks|说 出发啦！]]',
        checklist: [],
      },
      editorContext: {
        selectedTargetId: 'cat',
        selectedTargetName: 'Cat',
        targets: [
          {
            id: 'cat',
            name: 'Cat',
            blocks: [
              { id: 'hat', type: 'event_whenflagclicked', next: 'say' },
              {
                id: 'say',
                type: 'looks_say',
                parent: 'hat',
                inputs: { MESSAGE: [1, [10, '出发啦！']] },
              },
            ],
          },
        ],
      },
    })

    expect(result.status).toBe('complete')
    expect(result.completeCount).toBe(2)
  })

  it('checks expanded Scratch block values for richer lesson steps', () => {
    const result = buildScratchStepCheck({
      step: {
        title: '进阶互动',
        description: [
          '[[block:motion|将 y 坐标设为 鼠标的 y 坐标]]',
          '[[block:looks|将大小设为 60]]',
          '[[block:pen|将笔的大小设为 5]]',
          '[[block:control|重复执行直到 得分 = 10]]',
          '[[block:control|建立克隆体 自己]]',
          '[[block:data|将 得分 设为 10]]',
        ].join('，'),
        checklist: [],
      },
      editorContext: {
        selectedTargetId: 'cat',
        selectedTargetName: 'Cat',
        targets: [
          {
            id: 'cat',
            name: 'Cat',
            blocks: [
              {
                id: 'set-y',
                type: 'motion_sety',
                inputs: { Y: [3, 'mouse-y'] },
              },
              {
                id: 'mouse-y',
                type: 'sensing_mousey',
                label: '鼠标的 y 坐标',
              },
              {
                id: 'set-size',
                type: 'looks_setsizeto',
                inputs: { SIZE: [1, [4, '60']] },
              },
              {
                id: 'set-pen-size',
                type: 'pen_setPenSizeTo',
                inputs: { SIZE: [1, [4, '5']] },
              },
              {
                id: 'repeat-until',
                type: 'control_repeat_until',
                inputs: { CONDITION: [2, 'score-equals'] },
              },
              {
                id: 'score-equals',
                type: 'operator_equals',
                inputs: {
                  OPERAND1: [3, 'score-variable'],
                  OPERAND2: [1, [4, '10']],
                },
              },
              {
                id: 'score-variable',
                type: 'data_variable',
                fields: { VARIABLE: ['得分'] },
              },
              {
                id: 'create-clone',
                type: 'control_create_clone_of',
                fields: { CLONE_OPTION: ['自己'] },
              },
              {
                id: 'set-score',
                type: 'data_setvariableto',
                fields: { VARIABLE: ['得分'] },
                inputs: { VALUE: [1, [4, '10']] },
              },
            ],
          },
        ],
      },
    })

    expect(result.status).toBe('complete')
    expect(result.completeCount).toBe(6)
  })

  it('flags expanded Scratch editable values that differ from the lesson step', () => {
    const result = buildScratchStepCheck({
      step: {
        title: '变大一点',
        description: '[[block:looks|将大小设为 60]]',
        checklist: [],
      },
      editorContext: {
        selectedTargetId: 'cat',
        selectedTargetName: 'Cat',
        targets: [
          {
            id: 'cat',
            name: 'Cat',
            blocks: [
              {
                id: 'set-size',
                type: 'looks_setsizeto',
                inputs: { SIZE: [1, [4, '50']] },
              },
            ],
          },
        ],
      },
    })

    expect(result.status).toBe('needs_work')
    expect(result.items[0]).toMatchObject({
      status: 'needs_edit',
      originalIndex: 0,
    })
  })
})
