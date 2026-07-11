import { useCallback, useEffect, useRef, useState } from "react"
import {
    chooseAiMoveAsync,
    preloadGomokuAi,
} from "@/lib/playground/gomoku-ai-client"
import {
    checkWinner,
    cloneBoard,
    createEmptyBoard,
    EMPTY_GOMOKU_STATS,
    type GomokuPoint,
} from "@/lib/playground/gomoku-engine"
import type {
    GomokuCell,
    GomokuLevel,
    GomokuMode,
    GomokuPlayer,
    GomokuStats,
    GomokuStatus,
    WinnerInfo,
} from "@/lib/playground/gomoku-engine"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type {
    GomokuCell,
    GomokuLevel,
    GomokuMode,
    GomokuPlayer,
    GomokuStats,
    GomokuStatus,
    WinnerInfo,
} from "@/lib/playground/gomoku-engine"

const STATS_KEY = "gomoku_records"

function loadStats(): GomokuStats {
    const p = getPlaygroundItem<Partial<GomokuStats>>(STATS_KEY)
    if (!p) return { ...EMPTY_GOMOKU_STATS }
    return {
        totalGames: p.totalGames ?? 0,
        wins: p.wins ?? 0,
        losses: p.losses ?? 0,
        draws: p.draws ?? 0,
        bestMoves: p.bestMoves ?? null,
        gomokuPvEWins: p.gomokuPvEWins ?? 0,
    }
}

function saveStats(stats: GomokuStats) {
    // 合并到既有 records，避免覆盖在线对战写入的 gomokuOnlineWins 等字段。
    const existing = getPlaygroundItem<Record<string, unknown>>(STATS_KEY) ?? {}
    setPlaygroundItem(STATS_KEY, { ...existing, ...stats })
}

function opponentOf(player: GomokuPlayer): GomokuPlayer {
    return player === "black" ? "white" : "black"
}

export function useGomoku(
    mode: GomokuMode = "pve",
    level: GomokuLevel = "normal",
    /** PvE 时玩家执子颜色；黑先手。选白则 AI 执黑并先下。 */
    humanPlayer: GomokuPlayer = "black",
) {
    const [board, setBoard] = useState<GomokuCell[][]>(() => createEmptyBoard())
    const [currentPlayer, setCurrentPlayer] =
        useState<GomokuPlayer>("black")
    const [status, setStatus] = useState<GomokuStatus>("idle")
    const [winnerInfo, setWinnerInfo] = useState<WinnerInfo>(null)
    const [moveCount, setMoveCount] = useState(0)
    /** 有序着法（黑先），供 Rapfi YXBOARD 使用。 */
    const [moves, setMoves] = useState<GomokuPoint[]>([])
    // 服务端无 localStorage，初次渲染统一用空战绩，避免 SSR/CSR 不一致。
    const [stats, setStats] = useState<GomokuStats>(() => ({
        ...EMPTY_GOMOKU_STATS,
    }))

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    const aiPlayer: GomokuPlayer = opponentOf(humanPlayer)
    const isAiTurn =
        mode === "pve" && currentPlayer === aiPlayer && status === "playing"

    useEffect(() => {
        if (mode === "pve") {
            preloadGomokuAi()
        }
    }, [mode])

    const updateStats = useCallback(
        (result: "win" | "loss" | "draw") => {
            setStats(() => {
                // 从 localStorage 实时读最新值，避免 PvE 结算覆盖在线对战刚写入的字段。
                const prev = loadStats()
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
        setWinnerInfo(null)
        setMoveCount(0)
        setMoves([])
        // AI 执黑时直接进入 playing，触发先手搜索
        setStatus(mode === "pve" && humanPlayer === "white" ? "playing" : "idle")
    }, [humanPlayer, mode])

    // 切换执子颜色 / 模式后重置局面，避免旧棋盘与新颜色错位
    useEffect(() => {
        resetGame()
    }, [humanPlayer, mode, resetGame])

    const makeMove = useCallback(
        (row: number, col: number) => {
            if (status === "won" || status === "draw") return
            if (board[row][col].value !== null) return
            if (mode === "pve" && currentPlayer === aiPlayer) return

            const nextBoard = cloneBoard(board)
            nextBoard[row][col].value = currentPlayer
            const nextMoveCount = moveCount + 1
            const nextMoves = [...moves, { row, col }]

            const winner = checkWinner(nextBoard)
            if (winner) {
                setBoard(nextBoard)
                setMoves(nextMoves)
                setWinnerInfo(winner)
                setStatus("won")
                setMoveCount(nextMoveCount)
                updateStats(
                    mode === "pve"
                        ? winner.winner === humanPlayer
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
                setMoves(nextMoves)
                setStatus("draw")
                setMoveCount(nextMoveCount)
                updateStats("draw")
                return
            }

            setBoard(nextBoard)
            setMoves(nextMoves)
            setMoveCount(nextMoveCount)
            setStatus("playing")
            setCurrentPlayer((prev) => opponentOf(prev))
        },
        [
            aiPlayer,
            board,
            currentPlayer,
            humanPlayer,
            mode,
            moveCount,
            moves,
            status,
            updateStats,
        ],
    )

    const aiThinkingRef = useRef(false)
    const aiRequestIdRef = useRef(0)

    useEffect(() => {
        if (!isAiTurn) return
        if (aiThinkingRef.current) return
        aiThinkingRef.current = true
        const requestId = ++aiRequestIdRef.current
        const snapshotMoveCount = moveCount
        const searchBoard = cloneBoard(board)
        const searchMoves = moves.map((m) => ({ ...m }))
        // Rapfi 自身有思考时限，这里只留极短调度延迟
        const thinkDelayMs = 50

        const handle = window.setTimeout(() => {
            void chooseAiMoveAsync(
                searchBoard,
                aiPlayer,
                humanPlayer,
                level,
                searchMoves,
            ).then((chosen) => {
                if (requestId !== aiRequestIdRef.current) return
                if (!chosen) {
                    aiThinkingRef.current = false
                    return
                }

                const nextBoard = cloneBoard(searchBoard)
                nextBoard[chosen.row][chosen.col].value = aiPlayer
                const nextMoveCount = snapshotMoveCount + 1
                const nextMoves = [...searchMoves, chosen]
                const winner = checkWinner(nextBoard)
                if (winner) {
                    setBoard(nextBoard)
                    setMoves(nextMoves)
                    setWinnerInfo(winner)
                    setStatus("won")
                    setMoveCount(nextMoveCount)
                    updateStats(
                        winner.winner === humanPlayer ? "win" : "loss",
                    )
                } else {
                    const isFull = nextBoard.every((r) =>
                        r.every((c) => c.value !== null),
                    )
                    if (isFull) {
                        setBoard(nextBoard)
                        setMoves(nextMoves)
                        setStatus("draw")
                        setMoveCount(nextMoveCount)
                        updateStats("draw")
                    } else {
                        setBoard(nextBoard)
                        setMoves(nextMoves)
                        setMoveCount(nextMoveCount)
                        setStatus("playing")
                        setCurrentPlayer(humanPlayer)
                    }
                }
                aiThinkingRef.current = false
            })
        }, thinkDelayMs)

        return () => {
            window.clearTimeout(handle)
            aiRequestIdRef.current += 1
            aiThinkingRef.current = false
        }
    }, [
        aiPlayer,
        board,
        humanPlayer,
        isAiTurn,
        level,
        moveCount,
        moves,
        updateStats,
    ])

    return {
        board,
        currentPlayer,
        status,
        winnerInfo,
        moveCount,
        stats,
        mode,
        level,
        humanPlayer,
        aiPlayer,
        makeMove,
        resetGame,
    }
}
