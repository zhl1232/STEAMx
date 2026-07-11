import {
    GOMOKU_BOARD_SIZE,
    isPointOnBoard,
    type GomokuLevel,
    type GomokuPoint,
} from '@/lib/playground/gomoku-engine'

/** 公开静态资源路径（classic 单线程 Rapfi WASM，无需 COOP/COEP）。 */
export const RAPFI_WORKER_URL = '/gomoku-rapfi/rapfi-single.js'

/**
 * 三档棋力：通过 Rapfi INFO STRENGTH / 时限 / 深度区分。
 * strength 为 0–100 的棋力百分比（gomocalc 同款语义）。
 */
export const RAPFI_LEVEL_PRESETS: Record<
    GomokuLevel,
    {
        strength: number
        turnTimeMs: number
        maxDepth: number
        /** 选点范围 0–5，越大候选越宽、越强 */
        candRange: number
    }
> = {
    easy: { strength: 25, turnTimeMs: 400, maxDepth: 6, candRange: 1 },
    normal: { strength: 60, turnTimeMs: 1_200, maxDepth: 16, candRange: 2 },
    hard: { strength: 100, turnTimeMs: 2_500, maxDepth: 64, candRange: 3 },
}

/** 引擎就绪超时。 */
const READY_TIMEOUT_MS = 20_000

type RapfiOutput =
    | { ok: true }
    | { pos: [number, number] }
    | { error: string }
    | { msg: string }
    | { unknown: string }

type PendingThink = {
    resolve: (move: GomokuPoint | undefined) => void
    reject: (error: unknown) => void
    timer: ReturnType<typeof setTimeout>
}

let worker: Worker | null = null
let readyPromise: Promise<void> | null = null
let readyResolve: (() => void) | null = null
let readyReject: ((error: unknown) => void) | null = null
let readyTimer: ReturnType<typeof setTimeout> | null = null
let workerFailed = false
let pendingThink: PendingThink | null = null

function clearReadyTimer() {
    if (readyTimer) {
        clearTimeout(readyTimer)
        readyTimer = null
    }
}

function parseStdout(line: string): RapfiOutput | null {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'OK') return null

    const space = trimmed.indexOf(' ')
    if (space === -1) {
        if (trimmed === 'SWAP') return null
        const [x, y] = trimmed.split(',')
        const col = Number(x)
        const row = Number(y)
        if (Number.isInteger(col) && Number.isInteger(row)) {
            return { pos: [col, row] }
        }
        return { unknown: trimmed }
    }

    const head = trimmed.slice(0, space)
    const tail = trimmed.slice(space + 1)
    if (head === 'ERROR') return { error: tail }
    if (head === 'MESSAGE') return { msg: tail }
    // DEPTH / EVAL / BESTLINE / NODES 等分析输出忽略
    return null
}

function failPending(error: unknown) {
    if (!pendingThink) return
    const current = pendingThink
    pendingThink = null
    clearTimeout(current.timer)
    current.reject(error)
}

function settlePending(move: GomokuPoint | undefined) {
    if (!pendingThink) return
    const current = pendingThink
    pendingThink = null
    clearTimeout(current.timer)
    current.resolve(move)
}

function resetWorkerState() {
    clearReadyTimer()
    failPending(new Error('Rapfi worker reset'))
    readyPromise = null
    readyResolve = null
    readyReject = null
    if (worker) {
        worker.terminate()
        worker = null
    }
}

function handleWorkerMessage(event: MessageEvent) {
    const data = event.data as { ready?: boolean; output?: string } | string
    if (data && typeof data === 'object' && data.ready) {
        clearReadyTimer()
        readyResolve?.()
        readyResolve = null
        readyReject = null
        return
    }

    const outputLine =
        typeof data === 'string'
            ? data
            : typeof data?.output === 'string'
              ? data.output
              : null
    if (!outputLine) return

    const parsed = parseStdout(outputLine)
    if (!parsed) return

    if ('error' in parsed) {
        failPending(new Error(parsed.error))
        return
    }

    if ('pos' in parsed) {
        const [col, row] = parsed.pos
        const move = { row, col }
        if (!isPointOnBoard(move)) {
            failPending(new Error(`Rapfi returned off-board move ${col},${row}`))
            return
        }
        settlePending(move)
    }
}

function getWorker(): Worker {
    if (worker) return worker

    worker = new Worker(RAPFI_WORKER_URL)
    worker.onmessage = handleWorkerMessage
    worker.onerror = (event) => {
        workerFailed = true
        const error = event.error ?? new Error(event.message || 'Rapfi worker failed')
        readyReject?.(error)
        readyResolve = null
        readyReject = null
        failPending(error)
        resetWorkerState()
    }
    return worker
}

function ensureReady(): Promise<void> {
    if (workerFailed) {
        return Promise.reject(new Error('Rapfi worker unavailable'))
    }
    if (readyPromise) return readyPromise

    readyPromise = new Promise<void>((resolve, reject) => {
        readyResolve = resolve
        readyReject = reject
        try {
            getWorker()
        } catch (error) {
            workerFailed = true
            reject(error)
            return
        }
        readyTimer = setTimeout(() => {
            workerFailed = true
            reject(new Error('Rapfi engine ready timeout'))
            resetWorkerState()
        }, READY_TIMEOUT_MS)
    }).catch((error) => {
        workerFailed = true
        throw error
    })

    return readyPromise
}

function sendCommand(command: string) {
    const active = getWorker()
    active.postMessage(command)
}

/** 预加载 Rapfi Worker（进入 PvE 时可提前调用）。 */
export function preloadRapfi(): Promise<void> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
        return Promise.reject(new Error('Rapfi requires browser Worker'))
    }
    return ensureReady()
}

/**
 * 用有序着法列表向 Rapfi 要一手。坐标：Rapfi (x,y) = (col,row)。
 * 黑先；moves[0] 为黑方第一手。
 */
export async function chooseRapfiMove(
    moves: GomokuPoint[],
    level: GomokuLevel = 'normal',
): Promise<GomokuPoint | undefined> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
        throw new Error('Rapfi requires browser Worker')
    }
    if (workerFailed) {
        throw new Error('Rapfi worker unavailable')
    }

    await ensureReady()

    if (pendingThink) {
        throw new Error('Rapfi is already thinking')
    }

    const preset = RAPFI_LEVEL_PRESETS[level]
    const thinkTimeoutMs = preset.turnTimeMs + 8_000

    return new Promise<GomokuPoint | undefined>((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingThink = null
            // 单线程无法 YXSTOP，只能重启 Worker
            resetWorkerState()
            workerFailed = false
            reject(new Error('Rapfi think timeout'))
        }, thinkTimeoutMs)

        pendingThink = { resolve, reject, timer }

        try {
            sendCommand(`START ${GOMOKU_BOARD_SIZE}`)

            sendCommand('INFO RULE 0')
            sendCommand(`INFO STRENGTH ${preset.strength}`)
            sendCommand(`INFO TIMEOUT_TURN ${preset.turnTimeMs}`)
            sendCommand('INFO TIMEOUT_MATCH 100000000')
            sendCommand('INFO TIME_LEFT 100000000')
            sendCommand(`INFO MAX_DEPTH ${preset.maxDepth}`)
            sendCommand(`INFO CAUTION_FACTOR ${preset.candRange}`)
            sendCommand('INFO SHOW_DETAIL 1')

            let boardCmd = 'YXBOARD'
            let side = 1
            for (const move of moves) {
                if (!isPointOnBoard(move)) continue
                boardCmd += ` ${move.col},${move.row},${side}`
                side = 3 - side
            }
            boardCmd += ' DONE'
            sendCommand(boardCmd)
            sendCommand('YXNBEST 1')
        } catch (error) {
            clearTimeout(timer)
            pendingThink = null
            reject(error)
        }
    })
}

/** 测试或页面卸载时释放。 */
export function disposeRapfi() {
    workerFailed = false
    resetWorkerState()
}

export function isRapfiAvailable() {
    return (
        typeof window !== 'undefined' &&
        typeof Worker !== 'undefined' &&
        !workerFailed
    )
}
