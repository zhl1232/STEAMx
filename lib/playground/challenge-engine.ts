import { createHmac } from 'node:crypto'
import { MEMORY_LEVEL_THEMES } from './memory-levels'

export type ChallengeGame = 'gomoku' | 'memory'
export type ChallengePlayer = 0 | 1
export type ChallengeAction = { type: 'move'; row: number; col: number } | { type: 'flip'; cardId: string } | { type: 'resign' }
export type PrivateCard = { key: string; label: string; face: 'term' | 'def' }
export type MemoryProgress = {
  ids: string[]; matched: number[]; open: number[]; observed: number[]; lastFlipAt: number;
  nextPairAt: number; pairs: number; finishedAt: number | null
}
export type ChallengeState = {
  game: ChallengeGame; version: number; status: 'playing' | 'finished' | 'void'; winner: ChallengePlayer | 'draw' | null;
  startAt: number; deadlineAt: number; finishedAt: number | null; seed: string; strength: number; algorithmVersion: 1;
  board: Array<Array<ChallengePlayer | null>>; currentTurn: ChallengePlayer; firstPlayer: ChallengePlayer;
  remainingMs: [number, number]; turnStartedAt: number;
  theme: string; deck: PrivateCard[]; memory: [MemoryProgress, MemoryProgress]; botCounter: number
}
export const CHALLENGE_DURATION_MS = 120_000
export const CHALLENGE_STEP_MS = 20_000
export function challengeLevel(strength: number) { return Math.min(5, Math.max(1, Math.floor(strength / 20) + 1)) }
export function adjustedChallengeStrength(strength: number, result: 'win' | 'loss' | 'draw') {
  return Math.min(100, Math.max(0, strength + (result === 'win' ? 8 : result === 'loss' ? -8 : 0)))
}
// Private deterministic source: callers must supply cryptographically random server-only seeds.
export function challengeRandom(seed: string) {
  let counter = 0
  return () => createHmac('sha256', seed).update(String(counter++)).digest().readUInt32BE(0) / 4294967296
}

function clone(state: ChallengeState): ChallengeState { return JSON.parse(JSON.stringify(state)) as ChallengeState }
function finish(state: ChallengeState, winner: ChallengePlayer | 'draw', now: number) {
  state.status = 'finished'; state.winner = winner; state.finishedAt = now; state.version++
  return state
}
export function createChallengeState(options: {game: ChallengeGame; startAt: number; seed: string; strength?: number; theme?: string; pairCount?: number; firstPlayer?: ChallengePlayer}): ChallengeState {
  if (!Number.isFinite(options.startAt) || !options.seed) throw new Error('invalid_setup')
  const random = challengeRandom(options.seed)
  const theme = options.theme ? MEMORY_LEVEL_THEMES.find(t => t.id === options.theme) : MEMORY_LEVEL_THEMES[Math.floor(random() * MEMORY_LEVEL_THEMES.length)]
  if (!theme) throw new Error('invalid_theme')
  const pairCount = options.pairCount ?? 6
  if (![4, 6, 8].includes(pairCount)) throw new Error('invalid_pair_count')
  const deck: PrivateCard[] = theme.pairs.slice(0, pairCount).flatMap(p => [
    { key: p.key, label: p.term, face: 'term' as const }, { key: p.key, label: p.def, face: 'def' as const },
  ])
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]] }
  const opaque = () => Array.from({length: 5}, () => Math.floor(random() * 4294967296).toString(36)).join('')
  const progress = (): MemoryProgress => ({ ids: deck.map(opaque), matched: [], open: [], observed: [], lastFlipAt: options.startAt - 250, nextPairAt: options.startAt, pairs: 0, finishedAt: null })
  const firstPlayer = options.firstPlayer ?? (random() < .5 ? 0 : 1)
  return {game: options.game, version: 0, status: 'playing', winner: null, startAt: options.startAt, deadlineAt: options.startAt + CHALLENGE_DURATION_MS,
    finishedAt: null, seed: options.seed, strength: Math.min(100, Math.max(0, options.strength ?? 40)), algorithmVersion: 1,
    board: Array.from({length: 15}, () => Array<ChallengePlayer | null>(15).fill(null)), currentTurn: firstPlayer, firstPlayer,
    remainingMs: [CHALLENGE_DURATION_MS, CHALLENGE_DURATION_MS], turnStartedAt: options.startAt, theme: theme.id, deck,
    memory: [progress(), progress()], botCounter: 0}
}
export function challengeTurnDeadline(state: ChallengeState) {
  return state.turnStartedAt + Math.min(CHALLENGE_STEP_MS, state.remainingMs[state.currentTurn])
}
export function advanceChallengeTime(original: ChallengeState, now: number): ChallengeState {
  if (original.status !== 'playing' || now < original.startAt) return original
  if (original.game === 'gomoku') {
    const deadline = challengeTurnDeadline(original)
    if (now >= deadline) {
      const state = clone(original)
      state.remainingMs[state.currentTurn] = Math.max(0, state.remainingMs[state.currentTurn] - (deadline - state.turnStartedAt))
      return finish(state, state.currentTurn === 0 ? 1 : 0, deadline)
    }
  } else if (now >= original.deadlineAt) {
    const state = clone(original)
    const [a, b] = state.memory.map(p => p.pairs)
    return finish(state, a === b ? 'draw' : a > b ? 0 : 1, state.deadlineAt)
  }
  return original
}
function isFive(board: ChallengeState['board'], row: number, col: number, player: ChallengePlayer) {
  return [[1,0],[0,1],[1,1],[1,-1]].some(([dr,dc]) => {
    let n = 1
    for (const direction of [-1,1]) {
      for (let step = 1; step < 5; step++) {
        if (board[row + dr * step * direction]?.[col + dc * step * direction] !== player) break
        n++
      }
    }
    return n >= 5
  })
}
export function applyChallengeAction(original: ChallengeState, player: ChallengePlayer, action: ChallengeAction, now: number): ChallengeState {
  if (player !== 0 && player !== 1) throw new Error('invalid_player')
  const timed = advanceChallengeTime(original, now)
  // Return an expired authoritative result, never apply an action after its deadline.
  if (timed.status !== 'playing') return timed
  if (now < timed.startAt) throw new Error('not_started')
  const state = clone(timed)
  if (action.type === 'resign') return finish(state, player === 0 ? 1 : 0, now)
  if (state.game === 'gomoku') {
    if (action.type !== 'move' || player !== state.currentTurn) throw new Error('not_your_turn')
    const {row, col} = action
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= 15 || col < 0 || col >= 15 || state.board[row][col] !== null) throw new Error('invalid_move')
    state.remainingMs[player] -= now - state.turnStartedAt
    state.board[row][col] = player; state.version++
    if (isFive(state.board, row, col, player)) return finish(state, player, now)
    if (state.board.every(r => r.every(v => v !== null))) return finish(state, 'draw', now)
    state.currentTurn = player === 0 ? 1 : 0; state.turnStartedAt = now
  } else {
    if (action.type !== 'flip') throw new Error('invalid_action')
    const p = state.memory[player]
    if (now < p.nextPairAt || now - p.lastFlipAt < 250) throw new Error('too_fast')
    if (p.open.length === 2) p.open = []
    const index = p.ids.indexOf(action.cardId)
    if (index < 0 || p.open.includes(index) || p.matched.includes(index)) throw new Error('invalid_card')
    p.open.push(index); p.lastFlipAt = now
    p.observed = [...p.observed.filter(i => i !== index), index]
    state.version++
    if (p.open.length === 2) {
      const [a, b] = p.open
      const matched = state.deck[a].key === state.deck[b].key
      p.nextPairAt = now + (matched ? 320 : 900)
      if (matched) {
        p.matched.push(a,b); p.pairs++
        if (p.matched.length === state.deck.length) { p.finishedAt = now; return finish(state, player, now) }
      }
    }
  }
  return state
}
export function challengePublicState(state: ChallengeState, player: ChallengePlayer, now: number) {
  const own = state.memory[player], other = state.memory[player === 0 ? 1 : 0]
  const open = own.open.length < 2 || now < own.nextPairAt ? own.open : []
  return {
    game: state.game, version: state.version, status: state.status, winner: state.winner, startAt: state.startAt,
    deadlineAt: state.game === 'memory' ? state.deadlineAt : challengeTurnDeadline(state), finishedAt: state.finishedAt,
    level: challengeLevel(state.strength), theme: state.theme, pairCount: state.deck.length / 2,
    firstPlayer: state.firstPlayer, board: state.game === 'gomoku' ? state.board : undefined, currentTurn: state.currentTurn,
    myColor: player === state.firstPlayer ? 'black' as const : 'white' as const,
    remainingMs: state.remainingMs.map((v,i) => state.game === 'gomoku' && state.status === 'playing' && i === state.currentTurn ? Math.max(0,v - Math.max(0,now-state.turnStartedAt)) : v),
    turnDeadlineAt: state.game === 'gomoku' ? challengeTurnDeadline(state) : null,
    cards: state.game === 'memory' ? own.ids.map((id,i) => {
      const visible = own.matched.includes(i) || open.includes(i)
      return {id, matched: own.matched.includes(i), open: visible, ...(visible ? {label: state.deck[i].label, face: state.deck[i].face} : {})}
    }) : [],
    myPairs: own.pairs, opponentPairs: other.pairs, nextActionAt: Math.max(own.nextPairAt, own.lastFlipAt + 250),
  }
}
export type ChallengePublicState = ReturnType<typeof challengePublicState>
