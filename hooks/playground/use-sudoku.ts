import { useState, useCallback, useEffect, useRef } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

// ── Types ─────────────────────────────────────────────────────────────

export type SudokuDifficulty = "easy" | "medium" | "hard"

export type SudokuStatus = "idle" | "playing" | "won" | "checking"

export type SudokuStats = {
    totalGames: number
    wins: number
    bestTimes: Record<SudokuDifficulty, number | null>
    winsByDifficulty: Record<SudokuDifficulty, number>
}

type HistoryEntry = {
    board: number[][]
    notes: number[][][]
}

// ── Constants ─────────────────────────────────────────────────────────

const STATS_KEY = "sudoku_stats"
const MAX_HISTORY = 100
const CELLS_TO_REMOVE: Record<SudokuDifficulty, number> = {
    easy: 35,
    medium: 45,
    hard: 55,
}

const EMPTY_STATS: SudokuStats = {
    totalGames: 0,
    wins: 0,
    bestTimes: { easy: null, medium: null, hard: null },
    winsByDifficulty: { easy: 0, medium: 0, hard: 0 },
}

// ── Stats persistence ─────────────────────────────────────────────────

function loadStats(): SudokuStats {
    const p = getPlaygroundItem<Partial<SudokuStats>>(STATS_KEY)
    if (!p) return { ...EMPTY_STATS }
    return {
        totalGames: p.totalGames ?? 0,
        wins: p.wins ?? 0,
        bestTimes: {
            easy: p.bestTimes?.easy ?? null,
            medium: p.bestTimes?.medium ?? null,
            hard: p.bestTimes?.hard ?? null,
        },
        winsByDifficulty: {
            easy: p.winsByDifficulty?.easy ?? 0,
            medium: p.winsByDifficulty?.medium ?? 0,
            hard: p.winsByDifficulty?.hard ?? 0,
        },
    }
}

function saveStats(stats: SudokuStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

// ── Grid utilities ────────────────────────────────────────────────────

function createEmptyGrid(): number[][] {
    return Array.from({ length: 9 }, () => Array(9).fill(0))
}

function cloneGrid(grid: number[][]): number[][] {
    return grid.map(row => [...row])
}

function createBoolGrid(value: boolean): boolean[][] {
    return Array.from({ length: 9 }, () => Array(9).fill(value))
}

function createNotesGrid(): Set<number>[][] {
    return Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set<number>()),
    )
}

function notesToArrayGrid(notes: Set<number>[][]): number[][][] {
    return notes.map(row => row.map(cell => [...cell]))
}

function arrayGridToNotes(arr: number[][][]): Set<number>[][] {
    return arr.map(row => row.map(cell => new Set(cell)))
}

function cloneNotes(notes: Set<number>[][]): Set<number>[][] {
    return notes.map(row => row.map(cell => new Set(cell)))
}

// ── Shuffle helper ────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

// ── Board generation ──────────────────────────────────────────────────

function isValidPlacement(
    grid: number[][],
    row: number,
    col: number,
    num: number,
): boolean {
    for (let c = 0; c < 9; c++) {
        if (grid[row][c] === num) return false
    }
    for (let r = 0; r < 9; r++) {
        if (grid[r][col] === num) return false
    }
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
            if (grid[r][c] === num) return false
        }
    }
    return true
}

function fillDiagonalBoxes(grid: number[][]): void {
    for (let box = 0; box < 3; box++) {
        const startRow = box * 3
        const startCol = box * 3
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])
        let idx = 0
        for (let r = startRow; r < startRow + 3; r++) {
            for (let c = startCol; c < startCol + 3; c++) {
                grid[r][c] = nums[idx++]
            }
        }
    }
}

function solveSudoku(grid: number[][]): boolean {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (grid[r][c] !== 0) continue
            const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])
            for (const num of nums) {
                if (isValidPlacement(grid, r, c, num)) {
                    grid[r][c] = num
                    if (solveSudoku(grid)) return true
                    grid[r][c] = 0
                }
            }
            return false
        }
    }
    return true
}

function generateCompleteBoard(): number[][] {
    const grid = createEmptyGrid()
    fillDiagonalBoxes(grid)
    solveSudoku(grid)
    return grid
}

function createPuzzle(difficulty: SudokuDifficulty): {
    board: number[][]
    solution: number[][]
    initial: boolean[][]
} {
    const solution = generateCompleteBoard()
    const board = cloneGrid(solution)
    const initial = createBoolGrid(true)
    const toRemove = CELLS_TO_REMOVE[difficulty]

    const positions: [number, number][] = []
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            positions.push([r, c])
        }
    }
    const shuffled = shuffle(positions)

    let removed = 0
    for (const [r, c] of shuffled) {
        if (removed >= toRemove) break
        board[r][c] = 0
        initial[r][c] = false
        removed++
    }

    return { board, solution, initial }
}

// ── Conflict detection ────────────────────────────────────────────────

function detectConflicts(board: number[][]): Set<string> {
    const conflicts = new Set<string>()

    for (let r = 0; r < 9; r++) {
        const seen = new Map<number, number[]>()
        for (let c = 0; c < 9; c++) {
            const val = board[r][c]
            if (val === 0) continue
            if (!seen.has(val)) {
                seen.set(val, [c])
            } else {
                seen.get(val)!.push(c)
            }
        }
        for (const [, cols] of seen) {
            if (cols.length > 1) {
                for (const c of cols) conflicts.add(`${r},${c}`)
            }
        }
    }

    for (let c = 0; c < 9; c++) {
        const seen = new Map<number, number[]>()
        for (let r = 0; r < 9; r++) {
            const val = board[r][c]
            if (val === 0) continue
            if (!seen.has(val)) {
                seen.set(val, [r])
            } else {
                seen.get(val)!.push(r)
            }
        }
        for (const [, rows] of seen) {
            if (rows.length > 1) {
                for (const r of rows) conflicts.add(`${r},${c}`)
            }
        }
    }

    for (let boxR = 0; boxR < 3; boxR++) {
        for (let boxC = 0; boxC < 3; boxC++) {
            const seen = new Map<number, [number, number][]>()
            for (let r = boxR * 3; r < boxR * 3 + 3; r++) {
                for (let c = boxC * 3; c < boxC * 3 + 3; c++) {
                    const val = board[r][c]
                    if (val === 0) continue
                    if (!seen.has(val)) {
                        seen.set(val, [[r, c]])
                    } else {
                        seen.get(val)!.push([r, c])
                    }
                }
            }
            for (const [, cells] of seen) {
                if (cells.length > 1) {
                    for (const [r, c] of cells) conflicts.add(`${r},${c}`)
                }
            }
        }
    }

    return conflicts
}

// ── Note cleanup ──────────────────────────────────────────────────────

function cleanupNotesAfterPlacement(
    notes: Set<number>[][],
    row: number,
    col: number,
    num: number,
): Set<number>[][] {
    const next = cloneNotes(notes)
    next[row][col].clear()

    for (let c = 0; c < 9; c++) next[row][c].delete(num)
    for (let r = 0; r < 9; r++) next[r][col].delete(num)

    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
            next[r][c].delete(num)
        }
    }
    return next
}

// ── Win detection ─────────────────────────────────────────────────────

function checkWin(board: number[][], solution: number[][]): boolean {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0 || board[r][c] !== solution[r][c]) return false
        }
    }
    return true
}

// ── React Hook ────────────────────────────────────────────────────────

export function useSudoku() {
    const [board, setBoard] = useState<number[][]>(() => createEmptyGrid())
    const [solution, setSolution] = useState<number[][]>(() => createEmptyGrid())
    const [initial, setInitial] = useState<boolean[][]>(() => createBoolGrid(false))
    const [notes, setNotes] = useState<Set<number>[][]>(() => createNotesGrid())
    const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null)
    const [difficulty, setDifficulty] = useState<SudokuDifficulty>("easy")
    const [status, setStatus] = useState<SudokuStatus>("idle")
    const [time, setTime] = useState(0)
    const [conflicts, setConflicts] = useState<Set<string>>(() => new Set())
    const [stats, setStats] = useState<SudokuStats>(() => ({
        ...EMPTY_STATS,
        bestTimes: { easy: null, medium: null, hard: null },
        winsByDifficulty: { easy: 0, medium: 0, hard: 0 },
    }))
    const [isNoteMode, setIsNoteMode] = useState(false)

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const historyRef = useRef<HistoryEntry[]>([])
    const historyIndexRef = useRef(-1)
    const hasStartedRef = useRef(false)
    const checkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    // ── Timer helpers ─────────────────────────────────────────────────

    const startTimer = useCallback(() => {
        if (timerRef.current) return
        timerRef.current = setInterval(() => {
            setTime(prev => prev + 1)
        }, 1000)
    }, [])

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }, [])

    // ── History helpers ───────────────────────────────────────────────

    const pushHistory = useCallback((b: number[][], n: Set<number>[][]) => {
        const idx = historyIndexRef.current
        const newHistory = historyRef.current.slice(0, idx + 1)
        newHistory.push({
            board: cloneGrid(b),
            notes: notesToArrayGrid(n),
        })
        if (newHistory.length > MAX_HISTORY) {
            newHistory.shift()
        }
        historyRef.current = newHistory
        historyIndexRef.current = newHistory.length - 1
    }, [])

    // ── Persist stats helper ──────────────────────────────────────────

    const persistStats = useCallback((updater: (prev: SudokuStats) => SudokuStats) => {
        setStats(prev => {
            const next = updater(prev)
            saveStats(next)
            return next
        })
    }, [])

    // ── Ensure playing state & timer ──────────────────────────────────

    const ensurePlaying = useCallback(() => {
        if (!hasStartedRef.current) {
            hasStartedRef.current = true
            setStatus("playing")
            startTimer()
        }
    }, [startTimer])

    // ── selectCell ────────────────────────────────────────────────────

    const selectCell = useCallback((row: number, col: number) => {
        if (status === "won") return
        setSelectedCell([row, col])
    }, [status])

    // ── setNumber ─────────────────────────────────────────────────────

    const setNumber = useCallback((num: number) => {
        if (num < 1 || num > 9) return
        if (status === "won") return
        if (!selectedCell) return
        const [row, col] = selectedCell
        if (initial[row][col]) return

        ensurePlaying()

        if (isNoteMode) {
            setNotes(prev => {
                const next = cloneNotes(prev)
                if (next[row][col].has(num)) {
                    next[row][col].delete(num)
                } else {
                    next[row][col].add(num)
                }
                pushHistory(board, next)
                return next
            })
            return
        }

        setBoard(prev => {
            const next = cloneGrid(prev)
            next[row][col] = num

            const newConflicts = detectConflicts(next)
            setConflicts(newConflicts)

            const newNotes = cleanupNotesAfterPlacement(notes, row, col, num)
            setNotes(newNotes)
            pushHistory(next, newNotes)

            if (checkWin(next, solution)) {
                setStatus("won")
                stopTimer()
                persistStats(prev => {
                    const bestTime = prev.bestTimes[difficulty]
                    return {
                        totalGames: prev.totalGames + 1,
                        wins: prev.wins + 1,
                        bestTimes: {
                            ...prev.bestTimes,
                            [difficulty]: bestTime === null ? time : Math.min(bestTime, time),
                        },
                        winsByDifficulty: {
                            ...prev.winsByDifficulty,
                            [difficulty]: prev.winsByDifficulty[difficulty] + 1,
                        },
                    }
                })
            }

            return next
        })
    }, [
        status, selectedCell, initial, isNoteMode, board, notes,
        solution, difficulty, time, ensurePlaying, pushHistory, stopTimer, persistStats,
    ])

    // ── clearCell ─────────────────────────────────────────────────────

    const clearCell = useCallback(() => {
        if (status === "won") return
        if (!selectedCell) return
        const [row, col] = selectedCell
        if (initial[row][col]) return

        ensurePlaying()

        setBoard(prev => {
            const next = cloneGrid(prev)
            next[row][col] = 0
            setConflicts(detectConflicts(next))
            setNotes(prevNotes => {
                const nextNotes = cloneNotes(prevNotes)
                nextNotes[row][col].clear()
                pushHistory(next, nextNotes)
                return nextNotes
            })
            return next
        })
    }, [status, selectedCell, initial, ensurePlaying, pushHistory])

    // ── toggleNote ────────────────────────────────────────────────────

    const toggleNote = useCallback((num: number) => {
        if (num < 1 || num > 9) return
        if (status === "won") return
        if (!selectedCell) return
        const [row, col] = selectedCell
        if (initial[row][col]) return
        if (board[row][col] !== 0) return

        ensurePlaying()

        setNotes(prev => {
            const next = cloneNotes(prev)
            if (next[row][col].has(num)) {
                next[row][col].delete(num)
            } else {
                next[row][col].add(num)
            }
            pushHistory(board, next)
            return next
        })
    }, [status, selectedCell, initial, board, ensurePlaying, pushHistory])

    // ── toggleNoteMode ────────────────────────────────────────────────

    const toggleNoteMode = useCallback(() => {
        setIsNoteMode(prev => !prev)
    }, [])

    // ── checkErrors ───────────────────────────────────────────────────

    const checkErrors = useCallback(() => {
        if (status === "won") return
        const found = detectConflicts(board)
        setConflicts(found)
        setStatus("checking")
        const restoreStatus = hasStartedRef.current ? "playing" : "idle"

        if (checkingTimeoutRef.current) clearTimeout(checkingTimeoutRef.current)
        checkingTimeoutRef.current = setTimeout(() => {
            setStatus(prev => (prev === "checking" ? restoreStatus : prev))
            checkingTimeoutRef.current = null
        }, 2000)
    }, [status, board])

    // ── solve ─────────────────────────────────────────────────────────

    const solve = useCallback(() => {
        if (status === "won") return
        setBoard(cloneGrid(solution))
        setNotes(createNotesGrid())
        setConflicts(new Set())
        setStatus("won")
        stopTimer()
    }, [status, solution, stopTimer])

    // ── newGame ───────────────────────────────────────────────────────

    const newGame = useCallback((diff?: SudokuDifficulty) => {
        const d = diff ?? difficulty
        const puzzle = createPuzzle(d)

        stopTimer()
        if (checkingTimeoutRef.current) {
            clearTimeout(checkingTimeoutRef.current)
            checkingTimeoutRef.current = null
        }

        setDifficulty(d)
        setBoard(puzzle.board)
        setSolution(puzzle.solution)
        setInitial(puzzle.initial)
        setNotes(createNotesGrid())
        setSelectedCell(null)
        setStatus("idle")
        setTime(0)
        setConflicts(new Set())
        setIsNoteMode(false)
        hasStartedRef.current = false

        historyRef.current = [{
            board: cloneGrid(puzzle.board),
            notes: notesToArrayGrid(createNotesGrid()),
        }]
        historyIndexRef.current = 0
    }, [difficulty, stopTimer])

    // ── undo ──────────────────────────────────────────────────────────

    const undo = useCallback(() => {
        if (status === "won") return
        const idx = historyIndexRef.current
        if (idx <= 0) return

        historyIndexRef.current = idx - 1
        const entry = historyRef.current[idx - 1]
        const restoredBoard = cloneGrid(entry.board)
        const restoredNotes = arrayGridToNotes(entry.notes)

        setBoard(restoredBoard)
        setNotes(restoredNotes)
        setConflicts(detectConflicts(restoredBoard))
    }, [status])

    // ── redo ──────────────────────────────────────────────────────────

    const redo = useCallback(() => {
        if (status === "won") return
        const idx = historyIndexRef.current
        if (idx >= historyRef.current.length - 1) return

        historyIndexRef.current = idx + 1
        const entry = historyRef.current[idx + 1]
        const restoredBoard = cloneGrid(entry.board)
        const restoredNotes = arrayGridToNotes(entry.notes)

        setBoard(restoredBoard)
        setNotes(restoredNotes)
        setConflicts(detectConflicts(restoredBoard))
    }, [status])

    // ── Initialize on mount ───────────────────────────────────────────

    const initializedRef = useRef(false)
    useEffect(() => {
        if (!initializedRef.current) {
            initializedRef.current = true
            newGame("easy")
        }
    }, [newGame])

    // ── Cleanup on unmount ────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (checkingTimeoutRef.current) clearTimeout(checkingTimeoutRef.current)
        }
    }, [])

    return {
        board,
        initial,
        notes,
        solution,
        selectedCell,
        difficulty,
        status,
        time,
        conflicts,
        stats,
        isNoteMode,
        history: {
            canUndo: historyIndexRef.current > 0 && status !== "won",
            canRedo: historyIndexRef.current < historyRef.current.length - 1 && status !== "won",
        },
        selectCell,
        setNumber,
        clearCell,
        toggleNote,
        toggleNoteMode,
        checkErrors,
        solve,
        newGame,
        undo,
        redo,
    }
}
