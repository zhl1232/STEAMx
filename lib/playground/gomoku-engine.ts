export type GomokuPlayer = "black" | "white"

export type GomokuCell = {
    row: number
    col: number
    value: GomokuPlayer | null
}

export type GomokuStatus = "idle" | "playing" | "won" | "draw"

export type GomokuMode = "pvp" | "pve"

export type GomokuLevel = "easy" | "normal" | "hard"

export type GomokuPoint = { row: number; col: number }

export type WinnerInfo =
    | {
          winner: GomokuPlayer
          line: GomokuPoint[]
      }
    | null

export type GomokuStats = {
    totalGames: number
    wins: number
    losses: number
    draws: number
    bestMoves: number | null
    gomokuPvEWins: number
}

export type ScoredGomokuMove = GomokuPoint & {
    score: number
    rank: number
    kind: "win" | "block" | "vcf" | "vct" | "search" | "impact"
}

export const GOMOKU_BOARD_SIZE = 15
export const GOMOKU_WIN_COUNT = 5

const AI_DEPTH = 5
const ROOT_CANDIDATES = 12
const DEEP_CANDIDATES = 8
const WIN_SCORE = 5_000_000
const VCF_DEPTH = 10
const VCT_DEPTH = 8

const DIRS = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
]

const LINE_DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
] as const

const OPEN_THREE_PATTERNS = ["__aaa__", "_aa_a_", "_a_aa_"] as const

const PATTERN_TABLE: ReadonlyArray<readonly [string, number]> = [
    ["aaaaa", 10_000_000],
    ["_aaaa_", 1_000_000],
    ["baaaa_", 100_000],
    ["_aaaab", 100_000],
    ["aaa_a", 100_000],
    ["a_aaa", 100_000],
    ["aa_aa", 100_000],
    ["__aaa__", 10_000],
    ["_aa_a_", 10_000],
    ["_a_aa_", 10_000],
    ["__aaa_b", 1_000],
    ["b_aaa__", 1_000],
    ["_a_aab", 1_000],
    ["baa_a_", 1_000],
    ["_aa_ab", 1_000],
    ["ba_aa_", 1_000],
    ["_aaab", 1_000],
    ["baaa_", 1_000],
    ["__aa__", 500],
    ["_a_a_", 300],
    ["_a__a_", 200],
    ["_aa_b", 50],
    ["b_aa_", 50],
    ["__aab", 50],
    ["baa__", 50],
]

export const EMPTY_GOMOKU_STATS: GomokuStats = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    bestMoves: null,
    gomokuPvEWins: 0,
}

export function createEmptyBoard(): GomokuCell[][] {
    const board: GomokuCell[][] = []
    for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) {
        const row: GomokuCell[] = []
        for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
            row.push({ row: r, col: c, value: null })
        }
        board.push(row)
    }
    return board
}

/** 把棋盘压成可 postMessage 的一维数组（Worker 传输用）。 */
export function boardToValues(board: GomokuCell[][]): Array<GomokuPlayer | null> {
    const values: Array<GomokuPlayer | null> = []
    for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) {
        for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
            values.push(board[r][c].value)
        }
    }
    return values
}

/** 从一维数组还原可搜索的棋盘。 */
export function valuesToBoard(values: Array<GomokuPlayer | null>): GomokuCell[][] {
    const board = createEmptyBoard()
    for (let i = 0; i < values.length; i++) {
        const row = Math.floor(i / GOMOKU_BOARD_SIZE)
        const col = i % GOMOKU_BOARD_SIZE
        if (row >= GOMOKU_BOARD_SIZE || col >= GOMOKU_BOARD_SIZE) break
        board[row][col].value = values[i] ?? null
    }
    return board
}

export function cloneBoard(board: GomokuCell[][]): GomokuCell[][] {
    return board.map((row) => row.map((cell) => ({ ...cell })))
}

export function createBoardFromPoints({
    black,
    white,
}: {
    black?: GomokuPoint[]
    white?: GomokuPoint[]
}): GomokuCell[][] {
    const board = createEmptyBoard()
    for (const point of black ?? []) {
        if (isPointOnBoard(point)) board[point.row][point.col].value = "black"
    }
    for (const point of white ?? []) {
        if (isPointOnBoard(point)) board[point.row][point.col].value = "white"
    }
    return board
}

export function isSamePoint(left: GomokuPoint, right: GomokuPoint) {
    return left.row === right.row && left.col === right.col
}

export function isPointOnBoard(point: GomokuPoint) {
    return (
        Number.isInteger(point.row) &&
        Number.isInteger(point.col) &&
        point.row >= 0 &&
        point.row < GOMOKU_BOARD_SIZE &&
        point.col >= 0 &&
        point.col < GOMOKU_BOARD_SIZE
    )
}

export function checkWinner(board: GomokuCell[][]): WinnerInfo {
    for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) {
        for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
            const player = board[r][c].value
            if (!player) continue

            for (const { dr, dc } of DIRS) {
                const line: GomokuPoint[] = [{ row: r, col: c }]
                let nr = r + dr
                let nc = c + dc
                while (
                    nr >= 0 &&
                    nr < GOMOKU_BOARD_SIZE &&
                    nc >= 0 &&
                    nc < GOMOKU_BOARD_SIZE &&
                    board[nr][nc].value === player
                ) {
                    line.push({ row: nr, col: nc })
                    if (line.length === GOMOKU_WIN_COUNT) {
                        return { winner: player, line }
                    }
                    nr += dr
                    nc += dc
                }
            }
        }
    }
    return null
}

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
    while (
        r >= 0 &&
        r < GOMOKU_BOARD_SIZE &&
        c >= 0 &&
        c < GOMOKU_BOARD_SIZE
    ) {
        const value = board[r][c].value
        s += value === null ? "_" : value === player ? "a" : "b"
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
    for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) {
        total += scoreLine(lineString(board, r, 0, 0, 1, player))
    }
    for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
        total += scoreLine(lineString(board, 0, c, 1, 0, player))
    }
    for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
        total += scoreLine(lineString(board, 0, c, 1, 1, player))
    }
    for (let r = 1; r < GOMOKU_BOARD_SIZE; r++) {
        total += scoreLine(lineString(board, r, 0, 1, 1, player))
    }
    for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
        total += scoreLine(lineString(board, 0, c, 1, -1, player))
    }
    for (let r = 1; r < GOMOKU_BOARD_SIZE; r++) {
        total += scoreLine(
            lineString(board, r, GOMOKU_BOARD_SIZE - 1, 1, -1, player),
        )
    }
    return total
}

export function evaluateBoard(
    board: GomokuCell[][],
    player: GomokuPlayer,
): number {
    const opponent = getOpponent(player)
    return scorePlayer(board, player) - scorePlayer(board, opponent) * 1.05
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
            sr - dr < GOMOKU_BOARD_SIZE &&
            sc - dc >= 0 &&
            sc - dc < GOMOKU_BOARD_SIZE
        ) {
            sr -= dr
            sc -= dc
        }
        total += scoreLine(lineString(board, sr, sc, dr, dc, player))
    }
    return total
}

export function moveImpact(
    board: GomokuCell[][],
    row: number,
    col: number,
    player: GomokuPlayer,
): number {
    const opponent = getOpponent(player)
    const myBefore = sumLinesThrough(board, row, col, player)
    const opponentBefore = sumLinesThrough(board, row, col, opponent)
    board[row][col].value = player
    const myAfter = sumLinesThrough(board, row, col, player)
    const opponentAfter = sumLinesThrough(board, row, col, opponent)
    board[row][col].value = null
    return myAfter - myBefore + (opponentBefore - opponentAfter)
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
            if (
                r < 0 ||
                r >= GOMOKU_BOARD_SIZE ||
                c < 0 ||
                c >= GOMOKU_BOARD_SIZE
            ) {
                continue
            }
            if (board[r][c].value !== null) return true
        }
    }
    return false
}

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
            nr < GOMOKU_BOARD_SIZE &&
            nc >= 0 &&
            nc < GOMOKU_BOARD_SIZE &&
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
            nr < GOMOKU_BOARD_SIZE &&
            nc >= 0 &&
            nc < GOMOKU_BOARD_SIZE &&
            board[nr][nc].value === player
        ) {
            count++
            nr -= dr
            nc -= dc
        }
        if (count >= GOMOKU_WIN_COUNT) return true
    }
    return false
}

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
                if (
                    r < 0 ||
                    r >= GOMOKU_BOARD_SIZE ||
                    c < 0 ||
                    c >= GOMOKU_BOARD_SIZE
                ) {
                    break
                }
                const value = board[r][c].value
                if (value === player) return true
                if (value !== null) break
            }
        }
    }
    return false
}

export function findWinSpots(
    board: GomokuCell[][],
    player: GomokuPlayer,
): GomokuPoint[] {
    const spots: GomokuPoint[] = []
    for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) {
        for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
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

export function getScoredImpactCandidates(
    board: GomokuCell[][],
    player: GomokuPlayer,
    max = ROOT_CANDIDATES,
): ScoredGomokuMove[] {
    const scored: Array<GomokuPoint & { score: number }> = []
    for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) {
        for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
            if (board[r][c].value !== null) continue
            if (!hasNearbyStone(board, r, c, 2)) continue
            scored.push({
                row: r,
                col: c,
                score: moveImpact(board, r, c, player),
            })
        }
    }
    if (scored.length === 0) {
        const center = Math.floor(GOMOKU_BOARD_SIZE / 2)
        return [{ row: center, col: center, score: 0, rank: 1, kind: "impact" }]
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, max).map((move, index) => ({
        ...move,
        rank: index + 1,
        kind: "impact",
    }))
}

export function getCandidates(
    board: GomokuCell[][],
    player: GomokuPlayer,
    max: number,
): GomokuPoint[] {
    const opponent = getOpponent(player)
    const myWins = findWinSpots(board, player)
    if (myWins.length > 0) return [myWins[0]]

    const opponentWins = findWinSpots(board, opponent)
    if (opponentWins.length > 0) return opponentWins

    return getScoredImpactCandidates(board, player, max).map(({ row, col }) => ({
        row,
        col,
    }))
}

function findFourMoves(
    board: GomokuCell[][],
    player: GomokuPlayer,
): Array<{ move: GomokuPoint; wins: GomokuPoint[] }> {
    const result: Array<{ move: GomokuPoint; wins: GomokuPoint[] }> = []
    for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) {
        for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
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
    result.sort((a, b) => b.wins.length - a.wins.length)
    return result
}

export function vcfSearch(
    board: GomokuCell[][],
    attacker: GomokuPlayer,
    maxDepth: number,
): GomokuPoint | null {
    if (maxDepth <= 0) return null
    const defender = getOpponent(attacker)

    const immediate = findWinSpots(board, attacker)
    if (immediate.length > 0) return immediate[0]
    if (findWinSpots(board, defender).length > 0) return null

    const fours = findFourMoves(board, attacker)
    for (const { move, wins } of fours) {
        board[move.row][move.col].value = attacker

        if (findWinSpots(board, defender).length > 0) {
            board[move.row][move.col].value = null
            continue
        }

        if (wins.length >= 2) {
            board[move.row][move.col].value = null
            return move
        }

        const block = wins[0]
        board[block.row][block.col].value = defender
        const continuation = vcfSearch(board, attacker, maxDepth - 1)
        board[block.row][block.col].value = null
        board[move.row][move.col].value = null

        if (continuation) return move
    }
    return null
}

function lineHasOpenThree(line: string): boolean {
    return OPEN_THREE_PATTERNS.some((pattern) => line.includes(pattern))
}

function countOpenThrees(board: GomokuCell[][], player: GomokuPlayer): number {
    let total = 0
    const visit = (startR: number, startC: number, dr: number, dc: number) => {
        if (lineHasOpenThree(lineString(board, startR, startC, dr, dc, player))) {
            total += 1
        }
    }
    for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) visit(r, 0, 0, 1)
    for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) visit(0, c, 1, 0)
    for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) visit(0, c, 1, 1)
    for (let r = 1; r < GOMOKU_BOARD_SIZE; r++) visit(r, 0, 1, 1)
    for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) visit(0, c, 1, -1)
    for (let r = 1; r < GOMOKU_BOARD_SIZE; r++) {
        visit(r, GOMOKU_BOARD_SIZE - 1, 1, -1)
    }
    return total
}

function uniquePoints(points: GomokuPoint[]): GomokuPoint[] {
    const seen = new Set<string>()
    const result: GomokuPoint[] = []
    for (const point of points) {
        const key = `${point.row},${point.col}`
        if (seen.has(key)) continue
        seen.add(key)
        result.push(point)
    }
    return result
}

/**
 * 活三威胁：落子后尚未成冲四/活四，但下一手能冲四（对手通常必须挡）。
 * 返回 { move, defenseSpots }，defenseSpots 为对手必须应对的点。
 */
function findOpenThreeThreatMoves(
    board: GomokuCell[][],
    player: GomokuPlayer,
): Array<{ move: GomokuPoint; defenseSpots: GomokuPoint[] }> {
    const before = countOpenThrees(board, player)
    const result: Array<{ move: GomokuPoint; defenseSpots: GomokuPoint[] }> = []

    for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) {
        for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
            if (board[r][c].value !== null) continue
            if (!hasNearbyStone(board, r, c, 2)) continue

            board[r][c].value = player
            if (isFiveAt(board, r, c, player) || findWinSpots(board, player).length > 0) {
                board[r][c].value = null
                continue
            }

            const afterOpen = countOpenThrees(board, player)
            const nextFours = findFourMoves(board, player)
            board[r][c].value = null

            if (afterOpen <= before || nextFours.length === 0) continue
            result.push({
                move: { row: r, col: c },
                defenseSpots: uniquePoints(nextFours.map((item) => item.move)),
            })
        }
    }

    result.sort((a, b) => b.defenseSpots.length - a.defenseSpots.length)
    return result
}

function tryForcedWinBranch(
    board: GomokuCell[][],
    attacker: GomokuPlayer,
    defender: GomokuPlayer,
    move: GomokuPoint,
    defenseSpots: GomokuPoint[],
    maxDepth: number,
    continueSearch: (
        board: GomokuCell[][],
        attacker: GomokuPlayer,
        maxDepth: number,
    ) => GomokuPoint | null,
): boolean {
    board[move.row][move.col].value = attacker

    if (findWinSpots(board, defender).length > 0) {
        board[move.row][move.col].value = null
        return false
    }

    const spots = uniquePoints(defenseSpots)
    if (spots.length >= 2) {
        board[move.row][move.col].value = null
        return true
    }

    if (spots.length === 1) {
        const block = spots[0]
        board[block.row][block.col].value = defender
        const continuation = continueSearch(board, attacker, maxDepth - 1)
        board[block.row][block.col].value = null
        board[move.row][move.col].value = null
        return continuation !== null
    }

    board[move.row][move.col].value = null
    return false
}

/**
 * VCT：在 VCF（连续冲四）之外，允许用活三作为强制威胁推进。
 * 教学口径对齐课程「VCF 与 VCT」；深度受限，适合大师档。
 */
export function vctSearch(
    board: GomokuCell[][],
    attacker: GomokuPlayer,
    maxDepth: number,
): GomokuPoint | null {
    if (maxDepth <= 0) return null
    const defender = getOpponent(attacker)

    const immediate = findWinSpots(board, attacker)
    if (immediate.length > 0) return immediate[0]
    if (findWinSpots(board, defender).length > 0) return null

    const fours = findFourMoves(board, attacker)
    for (const { move, wins } of fours) {
        if (
            tryForcedWinBranch(
                board,
                attacker,
                defender,
                move,
                wins,
                maxDepth,
                vctSearch,
            )
        ) {
            return move
        }
    }

    if (maxDepth <= 1) return null

    const openThrees = findOpenThreeThreatMoves(board, attacker)
    for (const { move, defenseSpots } of openThrees) {
        if (
            tryForcedWinBranch(
                board,
                attacker,
                defender,
                move,
                defenseSpots,
                maxDepth,
                vctSearch,
            )
        ) {
            return move
        }
    }

    return null
}

function findDefenseAgainstForcedWin(
    board: GomokuCell[][],
    aiPlayer: GomokuPlayer,
    human: GomokuPlayer,
    search: (
        board: GomokuCell[][],
        attacker: GomokuPlayer,
        maxDepth: number,
    ) => GomokuPoint | null,
    maxDepth: number,
): GomokuPoint | undefined {
    if (!search(board, human, maxDepth)) return undefined

    const candidates = getCandidates(board, aiPlayer, ROOT_CANDIDATES)
    for (const move of candidates) {
        board[move.row][move.col].value = aiPlayer
        const stillForced = search(board, human, maxDepth)
        board[move.row][move.col].value = null
        if (!stillForced) return move
    }
    return undefined
}

function findWinningMove(
    board: GomokuCell[][],
    player: GomokuPlayer,
    candidates: GomokuPoint[],
): GomokuPoint | null {
    for (const move of candidates) {
        board[move.row][move.col].value = player
        const winner = checkWinner(board)
        board[move.row][move.col].value = null
        if (winner?.winner === player) return move
    }
    return null
}

export function minimax(
    board: GomokuCell[][],
    depth: number,
    maximizing: boolean,
    player: GomokuPlayer,
    alpha: number,
    beta: number,
): { score: number; move?: GomokuPoint } {
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

    const opponent = getOpponent(player)
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
        let bestMove: GomokuPoint | undefined
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
    }

    let bestScore = Infinity
    let bestMove: GomokuPoint | undefined
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

export function chooseAiMove(
    board: GomokuCell[][],
    aiPlayer: GomokuPlayer,
    human: GomokuPlayer,
    level: GomokuLevel,
): GomokuPoint | undefined {
    const myWins = findWinSpots(board, aiPlayer)
    if (myWins.length > 0) return myWins[0]
    const opponentWins = findWinSpots(board, human)
    if (opponentWins.length > 0) return opponentWins[0]

    if (level === "easy") {
        const pool = getScoredImpactCandidates(board, aiPlayer, 4)
        return pool[Math.floor(Math.random() * pool.length)]
    }

    if (level === "normal") {
        return minimax(board, 3, true, aiPlayer, -Infinity, Infinity).move
    }

    const vcf = vcfSearch(board, aiPlayer, VCF_DEPTH)
    if (vcf) return vcf

    const vct = vctSearch(board, aiPlayer, VCT_DEPTH)
    if (vct) return vct

    const blockVcf = findDefenseAgainstForcedWin(
        board,
        aiPlayer,
        human,
        vcfSearch,
        VCF_DEPTH,
    )
    if (blockVcf) return blockVcf

    const blockVct = findDefenseAgainstForcedWin(
        board,
        aiPlayer,
        human,
        vctSearch,
        VCT_DEPTH,
    )
    if (blockVct) return blockVct

    return minimax(board, AI_DEPTH, true, aiPlayer, -Infinity, Infinity).move
}

export function analyzeBestMoves(
    board: GomokuCell[][],
    player: GomokuPlayer,
    max = 5,
): ScoredGomokuMove[] {
    const opponent = getOpponent(player)
    const wins = findWinSpots(board, player)
    if (wins.length > 0) {
        return wins.slice(0, max).map((move, index) => ({
            ...move,
            score: WIN_SCORE,
            rank: index + 1,
            kind: "win",
        }))
    }

    const blocks = findWinSpots(board, opponent)
    if (blocks.length > 0) {
        return blocks.slice(0, max).map((move, index) => ({
            ...move,
            score: WIN_SCORE - 1,
            rank: index + 1,
            kind: "block",
        }))
    }

    const vcf = vcfSearch(board, player, VCF_DEPTH)
    if (vcf) {
        const impact = getScoredImpactCandidates(board, player, max)
        const rest = impact.filter((move) => !isSamePoint(move, vcf))
        return [
            { ...vcf, score: WIN_SCORE - 2, rank: 1, kind: "vcf" },
            ...rest.slice(0, Math.max(max - 1, 0)).map((move, index) => ({
                ...move,
                rank: index + 2,
            })),
        ]
    }

    const vct = vctSearch(board, player, VCT_DEPTH)
    if (vct) {
        const impact = getScoredImpactCandidates(board, player, max)
        const rest = impact.filter((move) => !isSamePoint(move, vct))
        return [
            { ...vct, score: WIN_SCORE - 3, rank: 1, kind: "vct" },
            ...rest.slice(0, Math.max(max - 1, 0)).map((move, index) => ({
                ...move,
                rank: index + 2,
            })),
        ]
    }

    const search = minimax(cloneBoard(board), 3, true, player, -Infinity, Infinity)
    const impact = getScoredImpactCandidates(board, player, max)
    if (!search.move) return impact

    const rest = impact.filter((move) => !isSamePoint(move, search.move!))
    return [
        {
            ...search.move,
            score: search.score,
            rank: 1,
            kind: "search",
        },
        ...rest.slice(0, Math.max(max - 1, 0)).map((move, index) => ({
            ...move,
            rank: index + 2,
        })),
    ]
}

function getOpponent(player: GomokuPlayer): GomokuPlayer {
    return player === "black" ? "white" : "black"
}
