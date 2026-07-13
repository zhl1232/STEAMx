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
})
