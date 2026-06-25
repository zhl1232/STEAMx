import { useCallback, useEffect, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"

export type GomokuPlayer = "black" | "white"

export type GomokuCell = {
    row: number
    col: number
    value: GomokuPlayer | null
}

export type GomokuStatus = "idle" | "playing" | "won" | "draw"

export type GomokuMode = "pvp" | "pve"

export type GomokuLevel = "easy" | "normal" | "hard"

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
const AI_DEPTH = 5
const ROOT_CANDIDATES = 12
const DEEP_CANDIDATES = 8
const WIN_SCORE = 5_000_000
const VCF_DEPTH = 10

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
    const p = getPlaygroundItem<Partial<GomokuStats>>(STATS_KEY)
    if (!p) return { ...EMPTY_STATS }
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
    // 合并到既有 records，避免覆盖在线对战写入的 gomokuOnlineWins 等字段
    const existing = getPlaygroundItem<Record<string, unknown>>(STATS_KEY) ?? {}
    setPlaygroundItem(STATS_KEY, { ...existing, ...stats })
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
// Each cell is encoded as a single char: 'a' = current player, 'b' =
// opponent or wall, '_' = empty. Lines are wrapped with 'b' boundaries
// so closed-end patterns near the edge are detected uniformly.
//
// Patterns are processed top-down (strongest threat first). The 'a'
// positions of a matched pattern are masked with '=' so weaker patterns
// can't double-count the same stones, but the '_' positions are left
// intact so an adjacent pattern using those empty cells can still match.

const PATTERN_TABLE: ReadonlyArray<readonly [string, number]> = [
    // 五连
    ["aaaaa", 10_000_000],
    // 活四（一手必胜）
    ["_aaaa_", 1_000_000],
    // 冲四 — 连续型，一侧被堵
    ["baaaa_", 100_000],
    ["_aaaab", 100_000],
    // 冲四 — 跳着的，填空即五连
    ["aaa_a", 100_000],
    ["a_aaa", 100_000],
    ["aa_aa", 100_000],
    // 活三 — 下一手能成活四
    ["__aaa__", 10_000],
    ["_aa_a_", 10_000],
    ["_a_aa_", 10_000],
    // 眠三 / 半活三
    ["__aaa_b", 1_000],
    ["b_aaa__", 1_000],
    ["_a_aab", 1_000],
    ["baa_a_", 1_000],
    ["_aa_ab", 1_000],
    ["ba_aa_", 1_000],
    ["_aaab", 1_000],
    ["baaa_", 1_000],
    // 活二
    ["__aa__", 500],
    ["_a_a_", 300],
    ["_a__a_", 200],
    // 眠二
    ["_aa_b", 50],
    ["b_aa_", 50],
    ["__aab", 50],
    ["baa__", 50],
]

const LINE_DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
] as const

function lineString(
    board: GomokuCell[][],
    startR: number,
    startC: number,
    dr: number,
    dc: number,
    player: GomokuPlayer,
): string {
    let s = "b"
    let r = startR
    let c = startC
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        const v = board[r][c].value
        s += v === null ? "_" : v === player ? "a" : "b"
        r += dr
        c += dc
    }
    s += "b"
    return s
}

function scoreLine(line: string): number {
    if (line.indexOf("a") < 0) return 0
    let s = line
    let total = 0
    for (const [pattern, value] of PATTERN_TABLE) {
        let idx = s.indexOf(pattern)
        if (idx < 0) continue
        let masked = ""
        for (let i = 0; i < pattern.length; i++) {
            masked += pattern[i] === "a" ? "=" : pattern[i]
        }
        while (idx >= 0) {
            total += value
            s = s.slice(0, idx) + masked + s.slice(idx + pattern.length)
            idx = s.indexOf(pattern, idx + 1)
        }
    }
    return total
}

function scorePlayer(board: GomokuCell[][], player: GomokuPlayer): number {
    let total = 0
    for (let r = 0; r < BOARD_SIZE; r++) {
        total += scoreLine(lineString(board, r, 0, 0, 1, player))
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
        total += scoreLine(lineString(board, 0, c, 1, 0, player))
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
        total += scoreLine(lineString(board, 0, c, 1, 1, player))
    }
    for (let r = 1; r < BOARD_SIZE; r++) {
        total += scoreLine(lineString(board, r, 0, 1, 1, player))
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
        total += scoreLine(lineString(board, 0, c, 1, -1, player))
    }
    for (let r = 1; r < BOARD_SIZE; r++) {
        total += scoreLine(lineString(board, r, BOARD_SIZE - 1, 1, -1, player))
    }
    return total
}

function evaluateBoard(board: GomokuCell[][], player: GomokuPlayer): number {
    const opponent: GomokuPlayer = player === "black" ? "white" : "black"
    return scorePlayer(board, player) - scorePlayer(board, opponent) * 1.05
}

// ── Board & move utilities ────────────────────────────────────────────

function cloneBoard(board: GomokuCell[][]): GomokuCell[][] {
    return board.map((row) => row.map((cell) => ({ ...cell })))
}

function sumLinesThrough(
    board: GomokuCell[][],
    row: number,
    col: number,
    player: GomokuPlayer,
): number {
    let total = 0
    for (const [dr, dc] of LINE_DIRS) {
        let sr = row
        let sc = col
        while (
            sr - dr >= 0 &&
            sr - dr < BOARD_SIZE &&
            sc - dc >= 0 &&
            sc - dc < BOARD_SIZE
        ) {
            sr -= dr
            sc -= dc
        }
        total += scoreLine(lineString(board, sr, sc, dr, dc, player))
    }
    return total
}

// Reward both the threats this move creates and the opponent threats it
// neutralises — the same heuristic guides search ordering and root choice.
function moveImpact(
    board: GomokuCell[][],
    row: number,
    col: number,
    player: GomokuPlayer,
): number {
    const opp: GomokuPlayer = player === "black" ? "white" : "black"
    const myBefore = sumLinesThrough(board, row, col, player)
    const oppBefore = sumLinesThrough(board, row, col, opp)
    board[row][col].value = player
    const myAfter = sumLinesThrough(board, row, col, player)
    const oppAfter = sumLinesThrough(board, row, col, opp)
    board[row][col].value = null
    return myAfter - myBefore + (oppBefore - oppAfter)
}

function hasNearbyStone(
    board: GomokuCell[][],
    row: number,
    col: number,
    range: number,
): boolean {
    for (let dr = -range; dr <= range; dr++) {
        for (let dc = -range; dc <= range; dc++) {
            if (dr === 0 && dc === 0) continue
            const r = row + dr
            const c = col + dc
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue
            if (board[r][c].value !== null) return true
        }
    }
    return false
}

// True if a 5-in-a-row passes through (row, col), which must currently hold a
// stone of `player`. Localised win check, much cheaper than scanning the full
// board.
function isFiveAt(
    board: GomokuCell[][],
    row: number,
    col: number,
    player: GomokuPlayer,
): boolean {
    for (const [dr, dc] of LINE_DIRS) {
        let count = 1
        let nr = row + dr
        let nc = col + dc
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
        nr = row - dr
        nc = col - dc
        while (
            nr >= 0 &&
            nr < BOARD_SIZE &&
            nc >= 0 &&
            nc < BOARD_SIZE &&
            board[nr][nc].value === player
        ) {
            count++
            nr -= dr
            nc -= dc
        }
        if (count >= WIN_COUNT) return true
    }
    return false
}

// True if (row, col) has a friendly stone within 4 cells along any line,
// without an opponent stone in between. A win spot must satisfy this.
function hasNearbyOwnStone(
    board: GomokuCell[][],
    row: number,
    col: number,
    player: GomokuPlayer,
): boolean {
    for (const [dr, dc] of LINE_DIRS) {
        for (const sign of [1, -1] as const) {
            for (let d = 1; d <= 4; d++) {
                const r = row + dr * sign * d
                const c = col + dc * sign * d
                if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break
                const v = board[r][c].value
                if (v === player) return true
                if (v !== null) break
            }
        }
    }
    return false
}

// Empty cells where placing `player` would create a 5-in-a-row.
function findWinSpots(
    board: GomokuCell[][],
    player: GomokuPlayer,
): { row: number; col: number }[] {
    const spots: { row: number; col: number }[] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].value !== null) continue
            if (!hasNearbyOwnStone(board, r, c, player)) continue
            board[r][c].value = player
            const win = isFiveAt(board, r, c, player)
            board[r][c].value = null
            if (win) spots.push({ row: r, col: c })
        }
    }
    return spots
}

function getCandidates(
    board: GomokuCell[][],
    player: GomokuPlayer,
    max: number,
): { row: number; col: number }[] {
    const opp: GomokuPlayer = player === "black" ? "white" : "black"

    // Forced response: if we can win immediately, just play it.
    const myWins = findWinSpots(board, player)
    if (myWins.length > 0) return [myWins[0]]

    // Forced response: if the opponent has a 5-threat, we must block it. If
    // they have two such threats we already lost — but try one anyway to keep
    // the game going.
    const oppWins = findWinSpots(board, opp)
    if (oppWins.length > 0) return oppWins

    const scored: { row: number; col: number; s: number }[] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].value !== null) continue
            if (!hasNearbyStone(board, r, c, 2)) continue
            scored.push({
                row: r,
                col: c,
                s: moveImpact(board, r, c, player),
            })
        }
    }
    if (scored.length === 0) {
        const center = Math.floor(BOARD_SIZE / 2)
        return [{ row: center, col: center }]
    }
    scored.sort((a, b) => b.s - a.s)
    return scored.slice(0, max).map(({ row, col }) => ({ row, col }))
}

// Moves that build a 4-pattern (rush four / open four) — i.e. that create at
// least one win spot for `player`. Each entry carries the resulting win spots
// so the VCF search can drive the forced response.
function findFourMoves(
    board: GomokuCell[][],
    player: GomokuPlayer,
): {
    move: { row: number; col: number }
    wins: { row: number; col: number }[]
}[] {
    const result: {
        move: { row: number; col: number }
        wins: { row: number; col: number }[]
    }[] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].value !== null) continue
            if (!hasNearbyStone(board, r, c, 2)) continue
            board[r][c].value = player
            if (isFiveAt(board, r, c, player)) {
                board[r][c].value = null
                continue
            }
            const wins = findWinSpots(board, player)
            board[r][c].value = null
            if (wins.length >= 1) {
                result.push({ move: { row: r, col: c }, wins })
            }
        }
    }
    // Prefer multi-threat moves (double four = win): they decide the search.
    result.sort((a, b) => b.wins.length - a.wins.length)
    return result
}

// Victory-by-continuous-fours: attacker plays a 4-threat, defender is forced
// to block at the unique win spot, repeat. Returns the move that starts the
// forced sequence, or null if none exists within `maxDepth` attacker plies.
function vcfSearch(
    board: GomokuCell[][],
    attacker: GomokuPlayer,
    maxDepth: number,
): { row: number; col: number } | null {
    if (maxDepth <= 0) return null
    const defender: GomokuPlayer = attacker === "black" ? "white" : "black"

    const immediate = findWinSpots(board, attacker)
    if (immediate.length > 0) return immediate[0]
    // If defender already has a 5-threat, attacker must block — no free VCF.
    if (findWinSpots(board, defender).length > 0) return null

    const fours = findFourMoves(board, attacker)
    for (const { move, wins } of fours) {
        board[move.row][move.col].value = attacker

        // Defender might have a winning move enabled by attacker's stone.
        if (findWinSpots(board, defender).length > 0) {
            board[move.row][move.col].value = null
            continue
        }

        // Double-four or better — defender can block at most one win spot.
        if (wins.length >= 2) {
            board[move.row][move.col].value = null
            return move
        }

        // Single rush-four — defender forced to block at wins[0].
        const block = wins[0]
        board[block.row][block.col].value = defender
        const cont = vcfSearch(board, attacker, maxDepth - 1)
        board[block.row][block.col].value = null
        board[move.row][move.col].value = null

        if (cont) return move
    }
    return null
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
            score:
                winner.winner === player
                    ? WIN_SCORE + depth
                    : -WIN_SCORE - depth,
        }
    }
    if (depth === 0) {
        return { score: evaluateBoard(board, player) }
    }

    const opponent: GomokuPlayer = player === "black" ? "white" : "black"
    const mover = maximizing ? player : opponent
    const limit = depth >= AI_DEPTH ? ROOT_CANDIDATES : DEEP_CANDIDATES
    const candidates = getCandidates(board, mover, limit)

    const winMove = findWinningMove(board, mover, candidates)
    if (winMove) {
        return {
            score: maximizing ? WIN_SCORE + depth : -WIN_SCORE - depth,
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

// ── AI move selection by difficulty level ─────────────────────────────

function chooseAiMove(
    board: GomokuCell[][],
    aiPlayer: GomokuPlayer,
    human: GomokuPlayer,
    level: GomokuLevel,
): { row: number; col: number } | undefined {
    // All levels still respect immediate win / 5-threat block — otherwise
    // the game would end on the next human move and feel broken.
    const myWins = findWinSpots(board, aiPlayer)
    if (myWins.length > 0) return myWins[0]
    const oppWins = findWinSpots(board, human)
    if (oppWins.length > 0) return oppWins[0]

    if (level === "easy") {
        // No search: pick a random move from the top impact candidates so the
        // AI stays in the action area but routinely misses combinations like
        // live three / rush four.
        const scored: { row: number; col: number; s: number }[] = []
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c].value !== null) continue
                if (!hasNearbyStone(board, r, c, 2)) continue
                scored.push({
                    row: r,
                    col: c,
                    s: moveImpact(board, r, c, aiPlayer),
                })
            }
        }
        if (scored.length === 0) {
            const center = Math.floor(BOARD_SIZE / 2)
            return { row: center, col: center }
        }
        scored.sort((a, b) => b.s - a.s)
        const pool = scored.slice(0, Math.min(4, scored.length))
        return pool[Math.floor(Math.random() * pool.length)]
    }

    if (level === "normal") {
        // Depth-3 minimax with forced-response candidates. No VCF — long
        // combination wins remain invisible to this level.
        const { move } = minimax(
            board,
            3,
            true,
            aiPlayer,
            -Infinity,
            Infinity,
        )
        return move
    }

    // hard: full strength — VCF (offence + defence) plus deep minimax.
    const vcf = vcfSearch(board, aiPlayer, VCF_DEPTH)
    if (vcf) return vcf

    const oppVcf = vcfSearch(board, human, VCF_DEPTH)
    if (oppVcf) {
        const candidates = getCandidates(board, aiPlayer, ROOT_CANDIDATES)
        for (const m of candidates) {
            board[m.row][m.col].value = aiPlayer
            const stillVcf = vcfSearch(board, human, VCF_DEPTH)
            board[m.row][m.col].value = null
            if (!stillVcf) return m
        }
    }

    const { move } = minimax(
        board,
        AI_DEPTH,
        true,
        aiPlayer,
        -Infinity,
        Infinity,
    )
    return move
}

// ── React Hook ────────────────────────────────────────────────────────

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
    const [stats, setStats] = useState<GomokuStats>(() => loadStats())

    const aiPlayer: GomokuPlayer = "white"
    const isAiTurn =
        mode === "pve" && currentPlayer === aiPlayer && status === "playing"

    const updateStats = useCallback(
        (result: "win" | "loss" | "draw") => {
            setStats(() => {
                // 从 localStorage 实时读最新值，避免内存快照过期导致覆盖
                // （例如在线对局已把 wins 写大，切回 PvE 结算时内存 prev 仍是旧值）。
                const prev = loadStats();
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
    }, [aiPlayer, board, isAiTurn, level, moveCount, status, updateStats])

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
