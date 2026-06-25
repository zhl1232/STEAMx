// 五子棋在线对战的共享类型与纯函数，供 API Route 与前端 hook 复用。
// 服务端权威逻辑（落子、胜负判定）在 SQL RPC gomoku_place_stone 内完成，
// 这里只保留与前端一致的数据结构、空棋盘构造与房间码生成。

export const GOMOKU_BOARD_SIZE = 15
export const GOMOKU_WIN_COUNT = 5
export const GOMOKU_TOTAL_CELLS = GOMOKU_BOARD_SIZE * GOMOKU_BOARD_SIZE
export const GOMOKU_ROOM_CODE_LENGTH = 6

export type GomokuColor = "black" | "white"

export type GomokuOnlineStatus = "waiting" | "playing" | "finished" | "cancelled"

export type GomokuCell = {
    row: number
    col: number
    value: GomokuColor | null
}

export type GomokuMove = {
    row: number
    col: number
    player: GomokuColor
    at: string
}

export type GomokuMatchRow = {
    id: string
    code: string
    host_user_id: string
    guest_user_id: string | null
    status: GomokuOnlineStatus
    board: GomokuCell[][]
    current_turn: GomokuColor
    host_color: GomokuColor
    moves: GomokuMove[]
    winner: GomokuColor | "draw" | null
    win_line: { row: number; col: number }[] | null
    created_at: string
    started_at: string | null
    finished_at: string | null
}

// RPC gomoku_place_stone 返回行
export type GomokuPlaceStoneResult = {
    ok: boolean
    reason: string
    board: GomokuCell[][] | null
    current_turn: GomokuColor | null
    winner: GomokuColor | "draw" | null
    win_line: { row: number; col: number }[] | null
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // 去掉易混淆字符

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

export function generateRoomCode(): string {
    let code = ""
    for (let i = 0; i < GOMOKU_ROOM_CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    return code
}

export function opponentColor(color: GomokuColor): GomokuColor {
    return color === "black" ? "white" : "black"
}
