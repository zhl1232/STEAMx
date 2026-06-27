import { useCallback, useEffect, useRef, useState } from "react"
import {
    checkWinner,
    chooseAiMove,
    cloneBoard,
    createEmptyBoard,
    EMPTY_GOMOKU_STATS,
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

export function useGomoku(
    mode: GomokuMode = "pve",
    level: GomokuLevel = "normal",
) {
    const [board, setBoard] = useState<GomokuCell[][]>(() => createEmptyBoard())
    const [currentPlayer, setCurrentPlayer] =
        useState<GomokuPlayer>("black")
    const [status, setStatus] = useState<GomokuStatus>("idle")
    const [winnerInfo, setWinnerInfo] = useState<WinnerInfo>(null)
    const [moveCount, setMoveCount] = useState(0)
    // 服务端无 localStorage，初次渲染统一用空战绩，避免 SSR/CSR 不一致。
    const [stats, setStats] = useState<GomokuStats>(() => ({
        ...EMPTY_GOMOKU_STATS,
    }))

    useEffect(() => {
        setStats(loadStats())
    }, [])

    const aiPlayer: GomokuPlayer = "white"
    const isAiTurn =
        mode === "pve" && currentPlayer === aiPlayer && status === "playing"

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
                setMoveCount(nextMoveCount)
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
            const chosen = chooseAiMove(searchBoard, aiPlayer, "black", level)

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
                        setMoveCount(nextMoveCount)
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
    }, [aiPlayer, board, isAiTurn, level, moveCount, updateStats])

    return {
        board,
        currentPlayer,
        status,
        winnerInfo,
        moveCount,
        stats,
        mode,
        level,
        makeMove,
        resetGame,
    }
}
