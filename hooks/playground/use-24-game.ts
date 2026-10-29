import { useState, useCallback, useEffect, useRef } from 'react'
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"
import {
  checkGame24Rule,
  DEFAULT_GAME24_LEVEL,
  GAME24_CLEAR_WINS,
  getGame24Level,
  isGame24LevelUnlocked,
  type Game24Level,
  type Game24Op,
} from "@/lib/playground/game24-levels"

// ── Types ─────────────────────────────────────────────────────────────

export type Card24 = {
  value: number
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs'
  label: string
}

export type Game24Status = 'idle' | 'playing' | 'solved' | 'skipped' | 'timeout'

export type Game24Stats = {
  totalRounds: number
  solvedCount: number
  skippedCount: number
  bestStreak: number
  bestTime: number | null
  averageTime: number | null
  /** 每个难度关卡答对的轮数 */
  levelWins: Record<string, number>
}

export type Game24Round = {
  cards: Card24[]
  solutions: string[]
}

// ── Constants ─────────────────────────────────────────────────────────

const STATS_KEY = 'game_24_stats'
const EPSILON = 1e-9
const SUITS: Card24['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs']
const VALUE_LABELS: Record<number, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
}

const EMPTY_STATS: Game24Stats = {
  totalRounds: 0,
  solvedCount: 0,
  skippedCount: 0,
  bestStreak: 0,
  bestTime: null,
  averageTime: null,
  levelWins: {},
}

// ── Stats persistence ─────────────────────────────────────────────────

function loadStats(): Game24Stats {
  const p = getPlaygroundItem<Partial<Game24Stats>>(STATS_KEY)
  if (!p) return { ...EMPTY_STATS }
  return {
    totalRounds: p.totalRounds ?? 0,
    solvedCount: p.solvedCount ?? 0,
    skippedCount: p.skippedCount ?? 0,
    bestStreak: p.bestStreak ?? 0,
    bestTime: p.bestTime ?? null,
    averageTime: p.averageTime ?? null,
    levelWins: p.levelWins && typeof p.levelWins === 'object' ? p.levelWins : {},
  }
}

function saveStats(stats: Game24Stats) {
  setPlaygroundItem(STATS_KEY, stats)
}

// ── Solver ─────────────────────────────────────────────────────────────

function getPermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr]
  const result: number[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const perm of getPermutations(rest)) {
      result.push([arr[i], ...perm])
    }
  }
  return result
}

function applyOp(a: number, op: string, b: number): number | null {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? null : a / b
    default: return null
  }
}

function fmt(a: string, op: string, b: string): string {
  return `(${a} ${op} ${b})`
}

function solve24(nums: number[], target = 24, ops: string[] = ['+', '-', '*', '/']): string[] {
  const solutions = new Set<string>()
  const perms = getPermutations(nums)

  for (const [a, b, c, d] of perms) {
    for (const op1 of ops) {
      for (const op2 of ops) {
        for (const op3 of ops) {
          const sa = String(a), sb = String(b), sc = String(c), sd = String(d)

          // ((a op1 b) op2 c) op3 d
          let r1 = applyOp(a, op1, b)
          if (r1 !== null) {
            let r2 = applyOp(r1, op2, c)
            if (r2 !== null) {
              let r3 = applyOp(r2, op3, d)
              if (r3 !== null && Math.abs(r3 - target) < EPSILON) {
                solutions.add(fmt(fmt(fmt(sa, op1, sb), op2, sc), op3, sd))
              }
            }
          }

          // (a op1 (b op2 c)) op3 d
          r1 = applyOp(b, op2, c)
          if (r1 !== null) {
            let r2 = applyOp(a, op1, r1)
            if (r2 !== null) {
              let r3 = applyOp(r2, op3, d)
              if (r3 !== null && Math.abs(r3 - target) < EPSILON) {
                solutions.add(fmt(fmt(sa, op1, fmt(sb, op2, sc)), op3, sd))
              }
            }
          }

          // (a op1 b) op2 (c op3 d)
          r1 = applyOp(a, op1, b)
          let r2 = applyOp(c, op3, d)
          if (r1 !== null && r2 !== null) {
            let r3 = applyOp(r1, op2, r2)
            if (r3 !== null && Math.abs(r3 - target) < EPSILON) {
              solutions.add(fmt(fmt(sa, op1, sb), op2, fmt(sc, op3, sd)))
            }
          }

          // a op1 ((b op2 c) op3 d)
          r1 = applyOp(b, op2, c)
          if (r1 !== null) {
            r2 = applyOp(r1, op3, d)
            if (r2 !== null) {
              let r3 = applyOp(a, op1, r2)
              if (r3 !== null && Math.abs(r3 - target) < EPSILON) {
                solutions.add(fmt(sa, op1, fmt(fmt(sb, op2, sc), op3, sd)))
              }
            }
          }

          // a op1 (b op2 (c op3 d))
          r1 = applyOp(c, op3, d)
          if (r1 !== null) {
            r2 = applyOp(b, op2, r1)
            if (r2 !== null) {
              let r3 = applyOp(a, op1, r2)
              if (r3 !== null && Math.abs(r3 - target) < EPSILON) {
                solutions.add(fmt(sa, op1, fmt(sb, op2, fmt(sc, op3, sd))))
              }
            }
          }
        }
      }
    }
  }

  return Array.from(solutions)
}

// ── Card helpers ──────────────────────────────────────────────────────

function makeCard(value: number, suit: Card24['suit']): Card24 {
  return { value, suit, label: VALUE_LABELS[value] }
}

/** 本关可行解：按目标和运算符求解，再按挑战规则过滤 */
export function solveForLevel(nums: number[], level: Game24Level): string[] {
  return solve24(nums, level.target, level.ops as Game24Op[] as string[]).filter((expr) => checkGame24Rule(expr, level) === null)
}

export function create24RoundFromValues(values: number[]): Game24Round {
  if (values.length !== 4 || values.some((value) => !Number.isInteger(value) || value < 1 || value > 13)) {
    throw new Error('24 点牌面必须是 4 个 1-13 之间的整数')
  }
  const cards = values.map((value, index) => makeCard(value, SUITS[index % SUITS.length]))
  const solutions = solve24(values)
  if (solutions.length === 0) {
    throw new Error('这组牌没有 24 点解法')
  }
  return { cards, solutions }
}

function generateCards(level: Game24Level = getGame24Level(DEFAULT_GAME24_LEVEL)): Game24Round {
  for (;;) {
    const cards: Card24[] = []
    for (let i = 0; i < 4; i++) {
      const value = Math.floor(Math.random() * level.maxValue) + 1
      const suit = SUITS[Math.floor(Math.random() * 4)]
      cards.push(makeCard(value, suit))
    }
    const solutions = solveForLevel(cards.map((c) => c.value), level)
    if (solutions.length > 0) return { cards, solutions }
  }
}

// ── Expression parser & evaluator ─────────────────────────────────────
// Recursive descent: expr → term (('+' | '-') term)*
//                    term → factor (('*' | '/') factor)*
//                    factor → '(' expr ')' | number

type ParseResult = { value: number; pos: number }

const FACE_CARD_PATTERN = /[AaJjQqKk]/g

function replaceFaceCardToken(token: string): string {
  switch (token.toUpperCase()) {
    case 'A':
      return '1'
    case 'J':
      return '11'
    case 'Q':
      return '12'
    case 'K':
      return '13'
    default:
      return token
  }
}

export function normalize24Expression(expr: string): string {
  return expr.replace(FACE_CARD_PATTERN, replaceFaceCardToken)
}

function parseExpr(s: string, pos: number): ParseResult {
  let left = parseTerm(s, pos)
  for (;;) {
    let p = left.pos
    while (p < s.length && s[p] === ' ') p++
    if (p >= s.length) break
    const ch = s[p]
    if (ch !== '+' && ch !== '-') break
    const right = parseTerm(s, p + 1)
    left = {
      value: ch === '+' ? left.value + right.value : left.value - right.value,
      pos: right.pos,
    }
  }
  return left
}

function parseTerm(s: string, pos: number): ParseResult {
  let left = parseFactor(s, pos)
  for (;;) {
    let p = left.pos
    while (p < s.length && s[p] === ' ') p++
    if (p >= s.length) break
    const ch = s[p]
    if (ch === '*' || ch === '×') {
      const right = parseFactor(s, p + 1)
      left = { value: left.value * right.value, pos: right.pos }
    } else if (ch === '/' || ch === '÷') {
      const right = parseFactor(s, p + 1)
      if (Math.abs(right.value) < EPSILON) {
        throw new Error('除数不能为 0')
      }
      left = { value: left.value / right.value, pos: right.pos }
    } else {
      break
    }
  }
  return left
}

function parseFactor(s: string, pos: number): ParseResult {
  while (pos < s.length && s[pos] === ' ') pos++
  if (pos >= s.length) throw new Error('表达式意外结束')

  if (s[pos] === '(') {
    const result = parseExpr(s, pos + 1)
    let p = result.pos
    while (p < s.length && s[p] === ' ') p++
    if (p >= s.length || s[p] !== ')') throw new Error('缺少右括号')
    return { value: result.value, pos: p + 1 }
  }

  let numStr = ''
  while (pos < s.length && s[pos] >= '0' && s[pos] <= '9') {
    numStr += s[pos]
    pos++
  }
  if (numStr.length === 0) throw new Error(`意外字符: "${s[pos]}"`)
  return { value: parseInt(numStr, 10), pos }
}

function extractNumbers(expr: string): number[] {
  const matches = expr.match(/\d+/g)
  return matches ? matches.map(Number) : []
}

export function validate24Expression(
  expr: string,
  cardValues: number[],
  level?: Game24Level,
): { valid: boolean; result: number; error?: string } {
  const target = level?.target ?? 24
  if (!/^[\dAJQKajqk+\-*/×÷() ]+$/.test(expr)) {
    return { valid: false, result: 0, error: '表达式包含无效字符' }
  }

  const normalizedExpr = normalize24Expression(expr)
  const numbers = extractNumbers(normalizedExpr)
  if (numbers.length !== 4) {
    return { valid: false, result: 0, error: `必须恰好使用 4 个数字，当前有 ${numbers.length} 个` }
  }

  const sortedCard = [...cardValues].sort((a, b) => a - b)
  const sortedExpr = [...numbers].sort((a, b) => a - b)
  for (let i = 0; i < 4; i++) {
    if (sortedCard[i] !== sortedExpr[i]) {
      return {
        valid: false,
        result: 0,
        error: `必须使用卡牌数值 [${cardValues.join(', ')}] 各一次`,
      }
    }
  }

  try {
    const result = parseExpr(normalizedExpr, 0)
    let p = result.pos
    while (p < normalizedExpr.length && normalizedExpr[p] === ' ') p++
    if (p < normalizedExpr.length) {
      return { valid: false, result: 0, error: '表达式语法错误' }
    }
    const isCorrect = Math.abs(result.value - target) < EPSILON
    const ruleError = isCorrect && level ? checkGame24Rule(normalizedExpr, level) : null
    if (ruleError) return { valid: false, result: result.value, error: ruleError }
    return {
      valid: isCorrect,
      result: result.value,
      error: isCorrect ? undefined : `表达式结果为 ${Number.isInteger(result.value) ? result.value : result.value.toFixed(2)}，不等于 ${target}`,
    }
  } catch (e) {
    return {
      valid: false,
      result: 0,
      error: e instanceof Error ? e.message : '表达式求值失败',
    }
  }
}

// ── React Hook ────────────────────────────────────────────────────────

export function use24Game(timerDuration = 60) {
  const [levelId, setLevelId] = useState(DEFAULT_GAME24_LEVEL)
  const level = getGame24Level(levelId)
  const levelRef = useRef(level)
  levelRef.current = level
  const initialRoundRef = useRef<{ cards: Card24[]; solutions: string[] } | null>(null)
  if (initialRoundRef.current === null) {
    initialRoundRef.current = generateCards()
  }
  const initialRound = initialRoundRef.current

  const [cards, setCards] = useState<Card24[]>(initialRound.cards)
  const [status, setStatus] = useState<Game24Status>('playing')
  const [timeLeft, setTimeLeft] = useState(timerDuration)
  const [round, setRound] = useState(1)
  const [streak, setStreak] = useState(0)
  const [solutions, setSolutions] = useState<string[]>([])
  const [hintLevel, setHintLevel] = useState(0)
  const [stats, setStats] = useState<Game24Stats>(() => ({ ...EMPTY_STATS }))

  usePlaygroundStatsLoader(() => setStats(loadStats()))

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const solutionsRef = useRef<string[]>(initialRound.solutions)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Timeout detection
  useEffect(() => {
    if (timeLeft === 0 && status === 'playing') {
      setStatus('timeout')
      setSolutions(solutionsRef.current)
      clearTimer()
      setStreak(0)
      setStats((prev) => {
        const next: Game24Stats = { ...prev, totalRounds: prev.totalRounds + 1 }
        saveStats(next)
        return next
      })
    }
  }, [timeLeft, status, clearTimer])

  const startTimer = useCallback(() => {
    clearTimer()
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearTimer])

  useEffect(() => {
    startTimer()
    return clearTimer
  }, [startTimer, clearTimer])

  const beginRound = useCallback((
    nextRound: number | ((prev: number) => number),
    roundData?: Game24Round,
  ) => {
    roundData ??= generateCards(levelRef.current)
    const { cards: newCards, solutions: newSolutions } = roundData
    setCards(newCards)
    solutionsRef.current = newSolutions
    setSolutions([])
    setHintLevel(0)
    setStatus('playing')
    setTimeLeft(timerDuration)
    setRound(nextRound)
    startTimer()
  }, [startTimer, timerDuration])

  const dealNewRound = useCallback(() => {
    beginRound((prev) => prev + 1)
  }, [beginRound])

  const newGame = useCallback(() => {
    setStreak(0)
    beginRound(1)
  }, [beginRound])

  const suspendRound = useCallback(() => {
    clearTimer()
    setStatus('idle')
    setSolutions([])
    setHintLevel(0)
  }, [clearTimer])

  const loadRoundFromValues = useCallback((values: number[], nextRound = 1) => {
    // 在线竞速固定用经典 24 点规则
    setLevelId(DEFAULT_GAME24_LEVEL)
    levelRef.current = getGame24Level(DEFAULT_GAME24_LEVEL)
    setStreak(0)
    beginRound(nextRound, create24RoundFromValues(values))
  }, [beginRound])

  const submitExpression = useCallback(
    (expr: string): { success: boolean; error?: string } => {
      if (status !== 'playing') {
        return { success: false, error: '当前不在游戏中' }
      }

      const validation = validate24Expression(expr, cards.map((c) => c.value), level)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      clearTimer()
      setStatus('solved')
      setSolutions(solutionsRef.current)

      const solveTime = timerDuration - timeLeft
      const newStreak = streak + 1
      setStreak(newStreak)

      setStats((prev) => {
        const newSolvedCount = prev.solvedCount + 1
        const prevTotal =
          prev.averageTime !== null ? prev.averageTime * prev.solvedCount : 0
        const newAvgTime = Math.round(((prevTotal + solveTime) / newSolvedCount) * 100) / 100

        const next: Game24Stats = {
          totalRounds: prev.totalRounds + 1,
          solvedCount: newSolvedCount,
          skippedCount: prev.skippedCount,
          bestStreak: Math.max(prev.bestStreak, newStreak),
          bestTime:
            prev.bestTime === null
              ? solveTime
              : Math.min(prev.bestTime, solveTime),
          averageTime: newAvgTime,
          levelWins: { ...prev.levelWins, [level.id]: (prev.levelWins[level.id] ?? 0) + 1 },
        }
        saveStats(next)
        return next
      })

      return { success: true }
    },
    [cards, clearTimer, level, status, streak, timerDuration, timeLeft],
  )

  const skipRound = useCallback(() => {
    if (status !== 'playing') return
    clearTimer()
    setStatus('skipped')
    setSolutions(solutionsRef.current)
    setStreak(0)
    setStats((prev) => {
      const next: Game24Stats = {
        ...prev,
        totalRounds: prev.totalRounds + 1,
        skippedCount: prev.skippedCount + 1,
      }
      saveStats(next)
      return next
    })
  }, [clearTimer, status])

  const getHintText = useCallback((): string | null => {
    const sols = solutionsRef.current
    if (!sols.length) return null
    const sample = sols[0]
    if (hintLevel <= 0) return null
    if (hintLevel === 1) {
      // Reveal first operator / grouping idea from sample
      const nums = cards.map((c) => c.value)
      if (!level.ops.includes('*')) {
        const sum = nums.reduce((a, b) => a + b, 0)
        return `提示：四张牌加起来是 ${sum}，比 ${level.target} ${sum > level.target ? `多 ${sum - level.target}` : sum < level.target ? `少 ${level.target - sum}` : '正好'}。把哪张牌改成“减”能补上差距？（减一张牌，总和会少它的 2 倍）`
      }
      if (level.requireDivision) return `提示：先找两张牌相除得到整数或分数，例如 8÷2=4、6÷3=2，再想办法凑 24。手上是 ${nums.join('、')}。`
      const factors = [3, 4, 6, 8, 2, 12].filter((f) => 24 % f === 0)
      return `提示：试试把 24 拆成两个整数相乘，例如 ${factors.slice(0, 3).map((f) => `${f}×${24 / f}`).join('、')}。手上是 ${nums.join('、')}。`
    }
    if (hintLevel === 2) {
      // Reveal half the expression
      const mid = Math.ceil(sample.length / 2)
      return `提示：解法开头类似 ${sample.slice(0, mid)}…`
    }
    return `提示：一种完整解法是 ${sample} = ${level.target}`
  }, [cards, hintLevel, level])

  const requestHint = useCallback(() => {
    if (status !== 'playing') return
    setHintLevel((prev) => Math.min(prev + 1, 3))
  }, [status])

  const selectLevel = useCallback((id: string) => {
    const next = getGame24Level(id)
    if (!isGame24LevelUnlocked(next, stats.levelWins)) return
    setLevelId(next.id)
    levelRef.current = next
    setStreak(0)
    beginRound(1, generateCards(next))
  }, [beginRound, stats.levelWins])

  return {
    level,
    levelWins: stats.levelWins,
    clearWins: GAME24_CLEAR_WINS,
    isLevelUnlocked: (target: Game24Level) => isGame24LevelUnlocked(target, stats.levelWins),
    selectLevel,
    cards,
    status,
    timeLeft,
    round,
    streak,
    stats,
    solutions,
    hintLevel,
    getHintText,
    requestHint,
    submitExpression,
    skipRound,
    newGame,
    dealNewRound,
    loadRoundFromValues,
    suspendRound,
  }
}
