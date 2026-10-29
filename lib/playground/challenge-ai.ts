import { challengeLevel, challengeRandom, type ChallengeAction, type ChallengePlayer, type ChallengeState } from './challenge-engine'
import { checkWinner, createEmptyBoard, evaluateBoard, findWinSpots, getCandidates, type GomokuCell, type GomokuPlayer, type GomokuPoint } from './gomoku-engine'

export const MEMORY_BOT_PROFILES = [
  {capacity: 2, recall: .5, intervalMs: 1800}, {capacity: 4, recall: .65, intervalMs: 1500},
  {capacity: 6, recall: .8, intervalMs: 1200}, {capacity: 8, recall: .9, intervalMs: 900},
  {capacity: 12, recall: 1, intervalMs: 700},
] as const
export function nextBotActionAt(state: ChallengeState, player: ChallengePlayer): number {
  if (state.status !== 'playing') return Infinity
  if (state.game === 'gomoku') return state.currentTurn === player ? state.turnStartedAt + 700 : Infinity
  const p = state.memory[player], profile = MEMORY_BOT_PROFILES[challengeLevel(state.strength)-1]
  return Math.max(state.startAt + profile.intervalMs, p.lastFlipAt + profile.intervalMs, p.nextPairAt)
}
// Search is iterative and cooperative: every node checks the hard deadline. No browser worker/Rapfi dependency.
export function boundedGomokuMove(board: GomokuCell[][], color: GomokuPlayer, level: number, random: () => number, budgetMs = 1400): GomokuPoint | undefined {
  const opponent = color === 'black' ? 'white' : 'black'
  const deadline = performance.now() + Math.min(1500, Math.max(1,budgetMs))
  const mine = findWinSpots(board, color), theirs = findWinSpots(board, opponent)
  if (mine.length) return mine[0]
  if (theirs.length) return theirs[0]
  const candidates = getCandidates(board, color, 12)
  let best = candidates[0]
  if (!best) return undefined
  if (level === 1) return candidates[Math.floor(random() * Math.min(4,candidates.length))]
  let nodes = 0
  const exhausted = Symbol('budget')
  function search(depth: number, mover: GomokuPlayer, alpha: number, beta: number): number {
    if (++nodes > 50_000 || performance.now() >= deadline) throw exhausted
    const winner = checkWinner(board)
    if (winner) return winner.winner === color ? 10_000_000 + depth : -10_000_000 - depth
    if (depth === 0) return evaluateBoard(board,color)
    const maximizing = mover === color
    let score = maximizing ? -Infinity : Infinity
    const moves = getCandidates(board,mover,8)
    if (!moves.length) return 0
    for (const move of moves) {
      board[move.row][move.col].value = mover
      let value: number
      try { value = search(depth-1,mover === 'black' ? 'white' : 'black',alpha,beta) }
      finally { board[move.row][move.col].value = null }
      score = maximizing ? Math.max(score,value) : Math.min(score,value)
      if (maximizing) alpha = Math.max(alpha,score); else beta = Math.min(beta,score)
      if (beta <= alpha) break
    }
    return score
  }
  for (let depth = 1; depth <= level; depth++) {
    let completedBest = best, completedScore = -Infinity
    try {
      for (const move of candidates) {
        if (performance.now() >= deadline) throw exhausted
        board[move.row][move.col].value = color
        let score: number
        try { score = search(depth-1,opponent,-Infinity,Infinity) }
        finally { board[move.row][move.col].value = null }
        if (score > completedScore) { completedScore = score; completedBest = move }
      }
      best = completedBest
    } catch (error) { if (error !== exhausted) throw error; break }
  }
  return best
}
export function chooseChallengeBotAction(state: ChallengeState, player: ChallengePlayer, now: number): ChallengeAction | null {
  if (now < nextBotActionAt(state,player) || state.status !== 'playing') return null
  const random = challengeRandom(`${state.seed}:bot:${player}:${state.version}`)
  const level = challengeLevel(state.strength)
  if (state.game === 'gomoku') {
    const board = createEmptyBoard()
    for (let row = 0; row < 15; row++) for (let col = 0; col < 15; col++) {
      const value = state.board[row][col]
      board[row][col].value = value === null ? null : value === state.firstPlayer ? 'black' : 'white'
    }
    const move = boundedGomokuMove(board,player === state.firstPlayer ? 'black' : 'white',level,random)
    return move ? {type: 'move',row:move.row,col:move.col} : null
  }
  if (now >= state.deadlineAt) return null
  const p = state.memory[player], profile = MEMORY_BOT_PROFILES[level-1]
  const open = p.open.length === 1 ? p.open : []
  const available = p.ids.map((_,i) => i).filter(i => !p.matched.includes(i) && !open.includes(i))
  if (!available.length) return null
  // Only these observed card positions may be dereferenced for their pairing key.
  const remembered = p.observed.slice(-profile.capacity).filter(i => !p.matched.includes(i)).filter(() => random() < profile.recall)
  let chosen: number | undefined
  if (open.length === 1) {
    const knownOpen = open[0] // Currently revealed card is always visible to its owner.
    chosen = remembered.find(i => i !== knownOpen && state.deck[i].key === state.deck[knownOpen].key)
  } else {
    chosen = remembered.find(a => remembered.some(b => a !== b && state.deck[a].key === state.deck[b].key))
  }
  if (chosen === undefined || !available.includes(chosen)) {
    const unseen = available.filter(i => !remembered.includes(i))
    const pool = unseen.length ? unseen : available
    chosen = pool[Math.floor(random()*pool.length)]
  }
  return {type:'flip', cardId:p.ids[chosen]}
}
