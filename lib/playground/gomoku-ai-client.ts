import {
    boardToValues,
    chooseAiMove,
    type GomokuCell,
    type GomokuLevel,
    type GomokuPlayer,
    type GomokuPoint,
} from '@/lib/playground/gomoku-engine'
import type {
    GomokuAiWorkerRequest,
    GomokuAiWorkerResponse,
} from '@/lib/playground/gomoku-ai.worker'
import {
    chooseRapfiMove,
    disposeRapfi,
    isRapfiAvailable,
    preloadRapfi,
} from '@/lib/playground/gomoku-rapfi'

type PendingRequest = {
    resolve: (move: GomokuPoint | undefined) => void
    reject: (error: unknown) => void
}

let worker: Worker | null = null
let workerFailed = false
let nextRequestId = 1
const pending = new Map<number, PendingRequest>()

function settle(id: number, move: GomokuPoint | undefined) {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    entry.resolve(move)
}

function failAll(error: unknown) {
    const entries = [...pending.entries()]
    pending.clear()
    for (const [, entry] of entries) {
        entry.reject(error)
    }
}

function getWorker(): Worker | null {
    if (workerFailed || typeof window === 'undefined' || typeof Worker === 'undefined') {
        return null
    }
    if (worker) return worker

    try {
        worker = new Worker(new URL('./gomoku-ai.worker.ts', import.meta.url), {
            type: 'module',
            name: 'gomoku-ai',
        })
    } catch {
        workerFailed = true
        worker = null
        return null
    }

    worker.onmessage = (event: MessageEvent<GomokuAiWorkerResponse>) => {
        const { id, move } = event.data
        settle(id, move ?? undefined)
    }
    worker.onerror = (event) => {
        workerFailed = true
        worker?.terminate()
        worker = null
        failAll(event.error ?? new Error('gomoku AI worker failed'))
    }
    return worker
}

/** 自研引擎兜底（Rapfi 不可用或非法落点时）。 */
function chooseLocalAiMoveAsync(
    board: GomokuCell[][],
    aiPlayer: GomokuPlayer,
    human: GomokuPlayer,
    level: GomokuLevel,
): Promise<GomokuPoint | undefined> {
    const activeWorker = getWorker()
    if (!activeWorker) {
        return Promise.resolve(chooseAiMove(board, aiPlayer, human, level))
    }

    const id = nextRequestId++
    const request: GomokuAiWorkerRequest = {
        id,
        values: boardToValues(board),
        aiPlayer,
        human,
        level,
    }

    return new Promise<GomokuPoint | undefined>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        try {
            activeWorker.postMessage(request)
        } catch {
            pending.delete(id)
            workerFailed = true
            worker?.terminate()
            worker = null
            resolve(chooseAiMove(board, aiPlayer, human, level))
        }
    }).catch(() => chooseAiMove(board, aiPlayer, human, level))
}

function isEmptyCell(board: GomokuCell[][], move: GomokuPoint) {
    return board[move.row]?.[move.col]?.value === null
}

/**
 * 三档均优先 Rapfi（STRENGTH/时限/深度区分）；失败时回退自研搜索。
 */
export function chooseAiMoveAsync(
    board: GomokuCell[][],
    aiPlayer: GomokuPlayer,
    human: GomokuPlayer,
    level: GomokuLevel,
    moves: GomokuPoint[] = [],
): Promise<GomokuPoint | undefined> {
    if (isRapfiAvailable()) {
        return chooseRapfiMove(moves, level)
            .then((move) => {
                if (move && isEmptyCell(board, move)) return move
                return chooseLocalAiMoveAsync(board, aiPlayer, human, level)
            })
            .catch(() => chooseLocalAiMoveAsync(board, aiPlayer, human, level))
    }

    return chooseLocalAiMoveAsync(board, aiPlayer, human, level)
}

/** 进入 PvE 时可预热 Rapfi，减少首手等待。 */
export function preloadGomokuAi(): void {
    if (!isRapfiAvailable()) return
    void preloadRapfi().catch(() => {
        // 预加载失败时仍由 chooseAiMoveAsync 回退自研引擎
    })
}

/** @deprecated 使用 preloadGomokuAi */
export const preloadGomokuHardAi = preloadGomokuAi

/** 测试或页面卸载时可主动释放 Worker。 */
export function disposeGomokuAiWorker() {
    failAll(new Error('gomoku AI worker disposed'))
    worker?.terminate()
    worker = null
    disposeRapfi()
}
