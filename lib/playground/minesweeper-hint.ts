export type PublicMinesweeperCellState = 'revealed' | 'flagged' | 'hidden'

export type PublicMinesweeperCell = {
  row: number
  col: number
  state: PublicMinesweeperCellState
  adjacentMines?: number
}

export type MinesweeperHint = {
  kind: 'safe' | 'mine'
  row: number
  col: number
  source: {
    row: number
    col: number
    adjacentMines: number
    flaggedNeighbors: number
    hiddenNeighbors: number
  }
}

function getNeighbors(board: PublicMinesweeperCell[][], row: number, col: number) {
  const neighbors: PublicMinesweeperCell[] = []
  for (let r = Math.max(0, row - 1); r <= Math.min(board.length - 1, row + 1); r += 1) {
    const currentRow = board[r] ?? []
    for (let c = Math.max(0, col - 1); c <= Math.min(currentRow.length - 1, col + 1); c += 1) {
      if (r !== row || c !== col) neighbors.push(currentRow[c])
    }
  }
  return neighbors
}

/**
 * Applies only standard visible-board deductions. Mine locations are deliberately
 * absent from the input type, so this function cannot inspect the generated mine map.
 */
export function findMinesweeperHint(board: PublicMinesweeperCell[][]): MinesweeperHint | null {
  const safeCandidates = new Map<string, MinesweeperHint>()
  const mineCandidates = new Map<string, MinesweeperHint>()

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
      const cell = board[row][col]
      if (cell.state !== 'revealed' || typeof cell.adjacentMines !== 'number') continue
      if (cell.adjacentMines < 0 || cell.adjacentMines > 8) continue

      const neighbors = getNeighbors(board, row, col)
      const flaggedNeighbors = neighbors.filter((neighbor) => neighbor.state === 'flagged').length
      const hiddenNeighbors = neighbors.filter((neighbor) => neighbor.state === 'hidden')
      if (hiddenNeighbors.length === 0) continue

      const remainingMines = cell.adjacentMines - flaggedNeighbors
      if (remainingMines < 0 || remainingMines > hiddenNeighbors.length) continue

      const kind = remainingMines === 0
        ? 'safe'
        : remainingMines === hiddenNeighbors.length
          ? 'mine'
          : null
      if (!kind) continue

      const candidates = kind === 'safe' ? safeCandidates : mineCandidates
      for (const target of hiddenNeighbors) {
        const key = `${target.row},${target.col}`
        if (candidates.has(key)) continue
        candidates.set(key, {
          kind,
          row: target.row,
          col: target.col,
          source: {
            row: cell.row,
            col: cell.col,
            adjacentMines: cell.adjacentMines,
            flaggedNeighbors,
            hiddenNeighbors: hiddenNeighbors.length,
          },
        })
      }
    }
  }

  return safeCandidates.values().next().value ?? mineCandidates.values().next().value ?? null
}

