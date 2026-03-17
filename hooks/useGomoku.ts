import { useCallback, useEffect, useRef, useState } from "react"

export type GomokuPlayer = "black" | "white"

export type GomokuCell = {
    row: number
    col: number
    value: GomokuPlayer | null
}

export type GomokuStatus = "idle" | "playing" | "won" | "draw"

export type GomokuMode = "pvp" | "pve"

type WinnerInfo =
    | {
          winner: GomokuPlayer
          line: { row: number; col: number }[]
      }
    | null

type GomokuStats = {
    totalGames: number
    wins: number
    losses: number
    draws: number
    bestMoves: number | null
    gomokuPvEWins: number
}

const BOARD_SIZE = 15
const WIN_COUNT = 5
const STATS_KEY = "gomoku_records"
const MAX_CANDIDATES = 20
const AI_DEPTH = 3

const EMPTY_STATS: GomokuStats = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    bestMoves: null,
    gomokuPvEWins: 0,
}

function createEmptyBoard(): GomokuCell[][] {
    const board: GomokuCell[][] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
        const row: GomokuCell[] = []
        for (let c = 0; c < BOARD_SIZE; c++) {
            row.push({ row: r, col: c, value: null })
        }
        board.push(row)
    }
    return board
}

function loadStats(): GomokuStats {
    if (typeof window === "undefined") return { ...EMPTY_STATS }
    try {
        const raw = window.localStorage.getItem(STATS_KEY)
        if (!raw) return { ...EMPTY_STATS }
        const p = JSON.parse(raw) as Partial<GomokuStats>
        return {
            totalGames: p.totalGames ?? 0,
            wins: p.wins ?? 0,
            losses: p.losses ?? 0,
            draws: p.draws ?? 0,
            bestMoves: p.bestMoves ?? null,
            gomokuPvEWins: p.gomokuPvEWins ?? 0,
        }
    } catch {
        return { ...EMPTY_STATS }
    }
}

function saveStats(stats: GomokuStats) {
    if (typeof window === "undefined") return
    try {
        window.localStorage.setItem(STATS_KEY, JSON.stringify(stats))
    } catch {
        /* ignore */
    }
}

// ── Win detection ─────────────────────────────────────────────────────

const DIRS = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
]

function checkWinner(board: GomokuCell[][]): WinnerInfo {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const player = board[r][c].value
            if (!player) continue

            for (const { dr, dc } of DIRS) {
                const line: { row: number; col: number }[] = [{ row: r, col: c }]
                let nr = r + dr
                let nc = c + dc
                while (
                    nr >= 0 &&
                    nr < BOARD_SIZE &&
                    nc >= 0 &&
                    nc < BOARD_SIZE &&
                    board[nr][nc].value === player
                ) {
                    line.push({ row: nr, col: nc })
                    if (line.length === WIN_COUNT) return { winner: player, line }
                    nr += dr
                    nc += dc
                }
            }
        }
    }
    return null
}

// ── Pattern-based evaluation ──────────────────────────────────────────
// Scans consecutive runs along all four directions, classifies by
// length and open ends, then maps to threat scores.

const S_FIVE = 100000
const S_OPEN_FOUR = 50000
const S_HALF_FOUR = 5000
const S_OPEN_THREE = 3000
const S_HALF_THREE = 500
const S_OPEN_TWO = 200
const S_HALF_TWO = 50

function scorePlayer(board: GomokuCell[][], player: GomokuPlayer): number {
    let score = 0

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].value !== player) continue

            for (const { dr, dc } of DIRS) {
                const pr = r - dr
                const pc = c - dc
                if (
                    pr >= 0 &&
                    pr < BOARD_SIZE &&
                    pc >= 0 &&
                    pc < BOARD_SIZE &&
                    board[pr][pc].value === player
                ) {
                    continue
                }

                let count = 0
                let nr = r
                let nc = c
                while (
                    nr >= 0 &&
                    nr < BOARD_SIZE &&
                    nc >= 0 &&
                    nc < BOARD_SIZE &&
                    board[nr][nc].value === player
                ) {
                    count++
                    nr += dr
                    nc += dc
                }

                if (count < 2) continue

                let openEnds = 0
                if (
                    pr >= 0 &&
                    pr < BOARD_SIZE &&
                    pc >= 0 &&
                    pc < BOARD_SIZE &&
                    board[pr][pc].value === null
                )
                    openEnds++
                if (
                    nr >= 0 &&
                    nr < BOARD_SIZE &&
                    nc >= 0 &&
                    nc < BOARD_SIZE &&
                    board[nr][nc].value === null
                )
                    openEnds++

                if (count >= 5) score += S_FIVE
                else if (count === 4)
                    score +=
                        openEnds === 2
                            ? S_OPEN_FOUR
                            : openEnds === 1
                              ? S_HALF_FOUR
                              : 0
                else if (count === 3)
                    score +=
                        openEnds === 2
                            ? S_OPEN_THREE
                            : openEnds === 1
                              ? S_HALF_THREE
                              : 0
                else if (count === 2)
                    score +=
                        openEnds === 2
                            ? S_OPEN_TWO
                            : openEnds === 1
                              ? S_HALF_TWO
                              : 0
            }
        }
    }
    return score
}

function evaluateBoard(board: GomokuCell[][], player: GomokuPlayer): number {
    const opponent: GomokuPlayer = player === "black" ? "white" : "black"
    return scorePlayer(board, player) - scorePlayer(board, opponent) * 1.1
}

// ── Board & move utilities ────────────────────────────────────────────

function cloneBoard(board: GomokuCell[][]): GomokuCell[][] {
    return board.map((row) => row.map((cell) => ({ ...cell })))
}

function getCandidateMoves(
    board: GomokuCell[][],
): { row: number; col: number }[] {
    const scored: { row: number; col: number; p: number }[] = []

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].value !== null) continue
            let near = 0
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    if (dr === 0 && dc === 0) continue
                    const nr = r + dr
                    const nc = c + dc
                    if (
                        nr >= 0 &&
                        nr < BOARD_SIZE &&
                        nc >= 0 &&
                        nc < BOARD_SIZE &&
                        board[nr][nc].value !== null
                    ) {
                        near += Math.abs(dr) <= 1 && Math.abs(dc) <= 1 ? 3 : 1
                    }
                }
            }
            if (near > 0) {
                scored.push({
                    row: r,
                    col: c,
                    p: near * 10 - (Math.abs(r - 7) + Math.abs(c - 7)),
                })
            }
        }
    }

    scored.sort((a, b) => b.p - a.p)

    if (scored.length === 0) {
        const center = Math.floor(BOARD_SIZE / 2)
        return [{ row: center, col: center }]
    }

    return scored
        .slice(0, MAX_CANDIDATES)
        .map(({ row, col }) => ({ row, col }))
}

function findWinningMove(
    board: GomokuCell[][],
    player: GomokuPlayer,
    candidates: { row: number; col: number }[],
): { row: number; col: number } | null {
    for (const m of candidates) {
        board[m.row][m.col].value = player
        const w = checkWinner(board)
        board[m.row][m.col].value = null
        if (w?.winner === player) return m
    }
    return null
}

// ── Minimax with alpha-beta pruning (in-place board mutation) ─────────

function minimax(
    board: GomokuCell[][],
    depth: number,
    maximizing: boolean,
    player: GomokuPlayer,
    alpha: number,
    beta: number,
): { score: number; move?: { row: number; col: number } } {
    const winner = checkWinner(board)
    if (winner) {
        return {
            score: winner.winner === player ? 100000 + depth : -100000 - depth,
        }
    }

    if (depth === 0) {
        return { score: evaluateBoard(board, player) }
    }

    const candidates = getCandidateMoves(board)
    const opponent: GomokuPlayer = player === "black" ? "white" : "black"
    const mover = maximizing ? player : opponent

    const winMove = findWinningMove(board, mover, candidates)
    if (winMove) {
        return {
            score: maximizing ? 100000 + depth : -100000 - depth,
            move: winMove,
        }
    }

    if (maximizing) {
        let bestScore = -Infinity
        let bestMove: { row: number; col: number } | undefined
        for (const move of candidates) {
            board[move.row][move.col].value = player
            const { score } = minimax(
                board,
                depth - 1,
                false,
                player,
                alpha,
                beta,
            )
            board[move.row][move.col].value = null
            if (score > bestScore) {
                bestScore = score
                bestMove = move
            }
            alpha = Math.max(alpha, score)
            if (beta <= alpha) break
        }
        return { score: bestScore, move: bestMove }
    } else {
        let bestScore = Infinity
        let bestMove: { row: number; col: number } | undefined
        for (const move of candidates) {
            board[move.row][move.col].value = opponent
            const { score } = minimax(
                board,
                depth - 1,
                true,
                player,
                alpha,
                beta,
            )
            board[move.row][move.col].value = null
            if (score < bestScore) {
                bestScore = score
                bestMove = move
            }
            beta = Math.min(beta, score)
            if (beta <= alpha) break
        }
        return { score: bestScore, move: bestMove }
    }
}

// ── React Hook ────────────────────────────────────────────────────────

export function useGomoku(mode: GomokuMode = "pve") {
    const [board, setBoard] = useState<GomokuCell[][]>(() => createEmptyBoard())
    const [currentPlayer, setCurrentPlayer] =
        useState<GomokuPlayer>("black")
    const [status, setStatus] = useState<GomokuStatus>("idle")
    const [winnerInfo, setWinnerInfo] = useState<WinnerInfo>(null)
    const [moveCount, setMoveCount] = useState(0)
    const [stats, setStats] = useState<GomokuStats>(() => loadStats())

    const aiPlayer: GomokuPlayer = "white"
    const isAiTurn =
        mode === "pve" && currentPlayer === aiPlayer && status === "playing"

    const updateStats = useCallback(
        (result: "win" | "loss" | "draw") => {
            setStats((prev) => {
                const next: GomokuStats = {
                    totalGames: prev.totalGames + 1,
                    wins: prev.wins + (result === "win" ? 1 : 0),
                    losses: prev.losses + (result === "loss" ? 1 : 0),
                    draws: prev.draws + (result === "draw" ? 1 : 0),
                    bestMoves:
                        result === "win"
                            ? prev.bestMoves === null
                                ? moveCount
                                : Math.min(prev.bestMoves, moveCount)
                            : prev.bestMoves,
                    gomokuPvEWins:
                        prev.gomokuPvEWins +
                        (result === "win" && mode === "pve" ? 1 : 0),
                }
                saveStats(next)
                return next
            })
        },
        [moveCount, mode],
    )

    const resetGame = useCallback(() => {
        setBoard(createEmptyBoard())
        setCurrentPlayer("black")
        setStatus("idle")
        setWinnerInfo(null)
        setMoveCount(0)
    }, [])

    const makeMove = useCallback(
        (row: number, col: number) => {
            if (status === "won" || status === "draw") return
            if (board[row][col].value !== null) return
            if (mode === "pve" && currentPlayer === aiPlayer) return

            const nextBoard = cloneBoard(board)
            nextBoard[row][col].value = currentPlayer
            const nextMoveCount = moveCount + 1

            const winner = checkWinner(nextBoard)
            if (winner) {
                setBoard(nextBoard)
                setWinnerInfo(winner)
                setStatus("won")
                setMoveCount(nextMoveCount)
                updateStats(
                    mode === "pve"
                        ? currentPlayer === "black"
                            ? "win"
                            : "loss"
                        : "win",
                )
                return
            }

            const isFull = nextBoard.every((r) =>
                r.every((c) => c.value !== null),
            )
            if (isFull) {
                setBoard(nextBoard)
                setStatus("draw")
                updateStats("draw")
                return
            }

            setBoard(nextBoard)
            setMoveCount(nextMoveCount)
            setStatus("playing")
            setCurrentPlayer((prev) =>
                prev === "black" ? "white" : "black",
            )
        },
        [aiPlayer, board, currentPlayer, mode, moveCount, status, updateStats],
    )

    const aiThinkingRef = useRef(false)

    useEffect(() => {
        if (!isAiTurn) return
        if (aiThinkingRef.current) return
        aiThinkingRef.current = true

        const handle = window.setTimeout(() => {
            const searchBoard = cloneBoard(board)
            const candidates = getCandidateMoves(searchBoard)

            let chosen: { row: number; col: number } | undefined

            const winMove = findWinningMove(searchBoard, aiPlayer, candidates)
            if (winMove) {
                chosen = winMove
            } else {
                const blockMove = findWinningMove(
                    searchBoard,
                    "black",
                    candidates,
                )
                if (blockMove) {
                    chosen = blockMove
                } else {
                    const { move } = minimax(
                        searchBoard,
                        AI_DEPTH,
                        true,
                        aiPlayer,
                        -Infinity,
                        Infinity,
                    )
                    chosen = move
                }
            }

            if (chosen) {
                const nextBoard = cloneBoard(board)
                nextBoard[chosen.row][chosen.col].value = aiPlayer
                const nextMoveCount = moveCount + 1
                const winner = checkWinner(nextBoard)
                if (winner) {
                    setBoard(nextBoard)
                    setWinnerInfo(winner)
                    setStatus("won")
                    setMoveCount(nextMoveCount)
                    updateStats("loss")
                } else {
                    const isFull = nextBoard.every((r) =>
                        r.every((c) => c.value !== null),
                    )
                    if (isFull) {
                        setBoard(nextBoard)
                        setStatus("draw")
                        updateStats("draw")
                    } else {
                        setBoard(nextBoard)
                        setMoveCount(nextMoveCount)
                        setStatus("playing")
                        setCurrentPlayer("black")
                    }
                }
            }
            aiThinkingRef.current = false
        }, 300)

        return () => {
            window.clearTimeout(handle)
            aiThinkingRef.current = false
        }
    }, [aiPlayer, board, isAiTurn, moveCount, status, updateStats])

    return {
        board,
        currentPlayer,
        status,
        winnerInfo,
        moveCount,
        stats,
        mode,
        makeMove,
        resetGame,
    }
}
