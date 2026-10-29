import { describe, expect, it } from 'vitest'
import { createEmptyBoard } from './gomoku-engine'
import { boundedGomokuMove } from './challenge-ai'
describe('challenge chess search', () => {
  it('takes an immediate win at every difficulty', () => {
    for (let level=1;level<=5;level++) {
      const board = createEmptyBoard()
      for(let col=3;col<7;col++) board[7][col].value='black'
      const move = boundedGomokuMove(board,'black',level,()=>.5)
      expect(move?.row).toBe(7)
      expect([2,7]).toContain(move?.col)
    }
  })
  it('blocks an immediate threat and does not mutate its input', () => {
    const board = createEmptyBoard()
    for(let col=3;col<7;col++) board[7][col].value='white'
    const before = structuredClone(board)
    const move = boundedGomokuMove(board,'black',5,()=>.5)
    expect(move?.row).toBe(7)
    expect([2,7]).toContain(move?.col)
    expect(board).toEqual(before)
  })
  it('retains a legal completed result when its search budget expires', () => {
    const board = createEmptyBoard(); board[7][7].value='black'
    const before = structuredClone(board)
    const move = boundedGomokuMove(board,'white',5,()=>.5,1)
    expect(move).toBeDefined()
    expect(board[move!.row][move!.col].value).toBeNull()
    expect(board).toEqual(before)
  })
})
