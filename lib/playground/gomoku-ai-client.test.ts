import { afterEach, describe, expect, it, vi } from 'vitest'

import { chooseAiMoveAsync, disposeGomokuAiWorker } from '@/lib/playground/gomoku-ai-client'
import { createBoardFromPoints } from '@/lib/playground/gomoku-engine'

describe('gomoku-ai-client', () => {
  afterEach(() => {
    disposeGomokuAiWorker()
    vi.unstubAllGlobals()
  })

  it('falls back to sync search when Worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined)

    const board = createBoardFromPoints({
      black: [
        { row: 7, col: 5 },
        { row: 7, col: 6 },
        { row: 7, col: 7 },
        { row: 7, col: 8 },
      ],
      white: [{ row: 9, col: 9 }],
    })

    await expect(chooseAiMoveAsync(board, 'white', 'black', 'hard')).resolves.toEqual({
      row: 7,
      col: 4,
    })
  })
})
