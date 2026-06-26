import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"

export type FifteenSize = 3 | 4 | 5

export type FifteenStats = {
    totalGames: number
    wins: number
    bestMoves: Record<string, number>
    bestTimes: Record<string, number>
}

const STATS_KEY = "fifteen_puzzle_stats"
const SWIPE_THRESHOLD = 30
const EMPTY_STATS: FifteenStats = {
    totalGames: 0,
    wins: 0,
    bestMoves: {},
    bestTimes: {},
}

function loadStats(): FifteenStats {
    const raw = getPlaygroundItem<Partial<FifteenStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        wins: typeof raw.wins === "number" ? raw.wins : 0,
        bestMoves: raw.bestMoves && typeof raw.bestMoves === "object" ? raw.bestMoves : {},
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
    }
}

function saveStats(stats: FifteenStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

export function createSolvedBoard(size: FifteenSize): number[] {
    return Array.from({ length: size * size }, (_, index) => (index + 1) % (size * size))
}

export function isSolvedBoard(board: number[]): boolean {
    for (let index = 0; index < board.length - 1; index++) {
        if (board[index] !== index + 1) return false
    }
    return board[board.length - 1] === 0
}

export function isSolvableBoard(board: number[], size: FifteenSize): boolean {
    const values = board.filter((value) => value !== 0)
    let inversions = 0
    for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
            if (values[i] > values[j]) inversions++
        }
    }
    if (size % 2 === 1) return inversions % 2 === 0
    const blankRowFromBottom = size - Math.floor(board.indexOf(0) / size)
    return blankRowFromBottom % 2 === 0 ? inversions % 2 === 1 : inversions % 2 === 0
}

function getMovableIndexes(board: number[], size: FifteenSize): number[] {
    const blank = board.indexOf(0)
    const row = Math.floor(blank / size)
    const col = blank % size
    const indexes: number[] = []
    if (row > 0) indexes.push(blank - size)
    if (row < size - 1) indexes.push(blank + size)
    if (col > 0) indexes.push(blank - 1)
    if (col < size - 1) indexes.push(blank + 1)
    return indexes
}

export function canMoveTile(board: number[], index: number, size: FifteenSize): boolean {
    return getMovableIndexes(board, size).includes(index)
}

export function moveTile(board: number[], index: number, size: FifteenSize): number[] {
    if (!canMoveTile(board, index, size)) return board
    const next = [...board]
    const blank = next.indexOf(0)
    next[blank] = next[index]
    next[index] = 0
    return next
}

function shuffledBoard(size: FifteenSize): number[] {
    let board = createSolvedBoard(size)
    let previousBlank = -1
    const steps = size * size * 30
    for (let step = 0; step < steps; step++) {
        const blank = board.indexOf(0)
        const choices = getMovableIndexes(board, size).filter((index) => index !== previousBlank)
        const nextIndex = choices[Math.floor(Math.random() * choices.length)] ?? getMovableIndexes(board, size)[0]
        previousBlank = blank
        board = moveTile(board, nextIndex, size)
    }
    return isSolvedBoard(board) ? moveTile(board, getMovableIndexes(board, size)[0], size) : board
}

export function useFifteenPuzzle(initialSize: FifteenSize = 4) {
    const [size, setSizeState] = useState<FifteenSize>(initialSize)
    const [board, setBoard] = useState<number[]>(() => createSolvedBoard(initialSize))
    const [moves, setMoves] = useState(0)
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "solved">("playing")
    const [stats, setStats] = useState<FifteenStats>(() => ({ ...EMPTY_STATS }))

    useEffect(() => {
        setStats(loadStats())
    }, [])

    useEffect(() => {
        setBoard(shuffledBoard(initialSize))
    }, [initialSize])

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => setTime((current) => current + 1), 1000)
        return () => clearInterval(id)
    }, [status])

    const startNewGame = useCallback((nextSize: FifteenSize = size) => {
        setSizeState(nextSize)
        setBoard(shuffledBoard(nextSize))
        setMoves(0)
        setTime(0)
        setStatus("playing")
    }, [size])

    const tilePositions = useMemo(() => board.map((value, index) => ({ value, index })), [board])

    const tapTile = useCallback((index: number) => {
        if (status === "solved") return
        const next = moveTile(board, index, size)
        if (next === board) return

        const nextMoves = moves + 1
        setBoard(next)
        setMoves(nextMoves)

        if (isSolvedBoard(next)) {
            setStatus("solved")
            setStats((prev) => {
                const key = String(size)
                const updated = {
                    totalGames: prev.totalGames + 1,
                    wins: prev.wins + 1,
                    bestMoves: {
                        ...prev.bestMoves,
                        [key]: prev.bestMoves[key] ? Math.min(prev.bestMoves[key], nextMoves) : nextMoves,
                    },
                    bestTimes: {
                        ...prev.bestTimes,
                        [key]: prev.bestTimes[key] ? Math.min(prev.bestTimes[key], time) : time,
                    },
                }
                saveStats(updated)
                return updated
            })
        }
    }, [board, moves, size, status, time])

    /** 方向键操作：箭头方向 = 滑块移动方向（如「上」让空格下方的滑块向上滑） */
    const moveByDirection = useCallback((direction: "up" | "down" | "left" | "right") => {
        const blank = board.indexOf(0)
        const row = Math.floor(blank / size)
        const col = blank % size
        let index = -1
        if (direction === "up" && row < size - 1) index = blank + size
        if (direction === "down" && row > 0) index = blank - size
        if (direction === "left" && col < size - 1) index = blank + 1
        if (direction === "right" && col > 0) index = blank - 1
        if (index >= 0) tapTile(index)
    }, [board, size, tapTile])

    /* ── 触摸滑动 ── */
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.cancelable) e.preventDefault()
        const touch = e.touches[0]
        touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }, [])

    const onTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return
        if (e.cancelable) e.preventDefault()
        const touch = e.changedTouches[0]
        const dx = touch.clientX - touchStartRef.current.x
        const dy = touch.clientY - touchStartRef.current.y
        touchStartRef.current = null

        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)
        if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return

        if (absDx > absDy) {
            moveByDirection(dx > 0 ? "right" : "left")
        } else {
            moveByDirection(dy > 0 ? "down" : "up")
        }
    }, [moveByDirection])

    return {
        size,
        board,
        tilePositions,
        moves,
        time,
        status,
        stats,
        canMove: (index: number) => canMoveTile(board, index, size),
        tapTile,
        moveByDirection,
        startNewGame,
        isSolvable: isSolvableBoard(board, size),
        onTouchStart,
        onTouchEnd,
    }
}
