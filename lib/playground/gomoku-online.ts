// 五子棋在线对战的共享类型与纯函数，供 API Route 与前端 hook 复用。
// 服务端权威逻辑（落子、胜负判定）在 SQL RPC gomoku_place_stone 内完成，
// 这里只保留与前端一致的数据结构、空棋盘构造与房间码生成。
// 房间码与状态类型复用 lib/playground/online-room.ts 的共享房间层。

import {
    generateRoomCode as generateSharedRoomCode,
    ROOM_CODE_LENGTH,
    type BaseMatchRow,
    type OnlineRoomStatus,
} from "@/lib/playground/online-room"

export const GOMOKU_BOARD_SIZE = 15
export const GOMOKU_WIN_COUNT = 5
export const GOMOKU_TOTAL_CELLS = GOMOKU_BOARD_SIZE * GOMOKU_BOARD_SIZE
export const GOMOKU_ROOM_CODE_LENGTH = ROOM_CODE_LENGTH

export type GomokuColor = "black" | "white"

export type GomokuOnlineStatus = OnlineRoomStatus

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

export type GomokuMatchRow = BaseMatchRow & {
    board: GomokuCell[][]
    current_turn: GomokuColor
    host_color: GomokuColor
    moves: GomokuMove[]
    winner: GomokuColor | "draw" | null
    win_line: { row: number; col: number }[] | null
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

export const generateRoomCode = generateSharedRoomCode

export function opponentColor(color: GomokuColor): GomokuColor {
    return color === "black" ? "white" : "black"
}
