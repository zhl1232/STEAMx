/// <reference lib="webworker" />

import {
    chooseAiMove,
    valuesToBoard,
    type GomokuLevel,
    type GomokuPlayer,
    type GomokuPoint,
} from '@/lib/playground/gomoku-engine'

export type GomokuAiWorkerRequest = {
    id: number
    values: Array<GomokuPlayer | null>
    aiPlayer: GomokuPlayer
    human: GomokuPlayer
    level: GomokuLevel
}

export type GomokuAiWorkerResponse = {
    id: number
    move: GomokuPoint | null
}

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<GomokuAiWorkerRequest>) => {
    const { id, values, aiPlayer, human, level } = event.data
    const board = valuesToBoard(values)
    const move = chooseAiMove(board, aiPlayer, human, level) ?? null
    const response: GomokuAiWorkerResponse = { id, move }
    workerScope.postMessage(response)
}
