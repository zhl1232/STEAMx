import { describe, expect, it } from 'vitest'

import {
  findMinesweeperHint,
  type PublicMinesweeperCell,
  type PublicMinesweeperCellState,
} from '@/lib/playground/minesweeper-hint'

function board(states: Array<Array<PublicMinesweeperCellState | number>>): PublicMinesweeperCell[][] {
  return states.map((row, rowIndex) =>
    row.map((value, colIndex) => ({
      row: rowIndex,
      col: colIndex,
      state: typeof value === 'number' ? 'revealed' : value,
      adjacentMines: typeof value === 'number' ? value : undefined,
    })),
  )
}

describe('findMinesweeperHint', () => {
  it('finds a safe cell when the visible number already has enough flags', () => {
    const hint = findMinesweeperHint(board([
      ['flagged', 'hidden'],
      [1, 1],
    ]))

    expect(hint).toEqual({
      kind: 'safe',
      row: 0,
      col: 1,
      source: {
        row: 1,
        col: 0,
        adjacentMines: 1,
        flaggedNeighbors: 1,
        hiddenNeighbors: 1,
      },
    })
  })

  it('finds a forced mine when all remaining hidden neighbors must be mines', () => {
    const hint = findMinesweeperHint(board([
      ['flagged', 'hidden'],
      [2, 'revealed'],
    ]))

    expect(hint).toMatchObject({
      kind: 'mine',
      row: 0,
      col: 1,
      source: {
        adjacentMines: 2,
        flaggedNeighbors: 1,
        hiddenNeighbors: 1,
      },
    })
  })

  it('prefers an actionable safe cell when both hint kinds exist', () => {
    const hint = findMinesweeperHint(board([
      [1, 'hidden', 'revealed', 1, 'flagged'],
      ['revealed', 'revealed', 'revealed', 'revealed', 'hidden'],
    ]))

    expect(hint).toMatchObject({ kind: 'safe', row: 1, col: 4 })
  })

  it('returns no hint when visible constraints do not determine a cell', () => {
    expect(findMinesweeperHint(board([
      [1, 'hidden'],
      ['hidden', 'hidden'],
    ]))).toBeNull()
  })

  it('ignores inconsistent flag counts instead of making an unsafe deduction', () => {
    expect(findMinesweeperHint(board([
      ['flagged', 'flagged', 'hidden'],
      [1, 'revealed', 'revealed'],
    ]))).toBeNull()
  })
})
