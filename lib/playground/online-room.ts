// 游乐场在线对战「房间层」的共享类型与纯函数，供五子棋、记忆翻牌等多人游戏复用。
// 传输层（channel 订阅 / postgres_changes / 轮询兜底 / 断线重连）在 hooks/playground/use-game-room.ts，
// 各游戏的权威规则在各自的 SQL RPC 内完成，这里只保留与游戏无关的房间码与状态类型。

export const ROOM_CODE_LENGTH = 6

// 去掉易混淆字符（0/O、1/I/L）
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

/** 所有在线对局共享的状态机：等待加入 → 进行中 → 结束（或建房方取消）。 */
export type OnlineRoomStatus = "waiting" | "playing" | "finished" | "cancelled"

/**
 * 所有在线对局行的公共字段。各游戏的对局行在此之上扩展棋盘/牌堆等专属字段。
 * useGameRoom 的房间状态机只依赖这些公共字段。
 */
export type BaseMatchRow = {
    id: string
    code: string
    host_user_id: string
    guest_user_id: string | null
    status: OnlineRoomStatus
    created_at: string
    started_at: string | null
    finished_at: string | null
}

export function generateRoomCode(): string {
    let code = ""
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    return code
}
