import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    chooseRapfiMove,
    disposeRapfi,
    RAPFI_WORKER_URL,
} from '@/lib/playground/gomoku-rapfi'

class MockRapfiWorker {
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: ErrorEvent) => void) | null = null
    commands: string[] = []

    constructor(public url: string | URL) {}

    postMessage(data: unknown) {
        this.commands.push(String(data))
        // 模拟引擎在收到 YXNBEST 后回传坐标
        if (String(data).startsWith('YXNBEST')) {
            queueMicrotask(() => {
                this.onmessage?.({
                    data: { output: '7,7' },
                } as MessageEvent)
            })
        }
    }

    terminate() {}

    /** 测试辅助：标记引擎就绪 */
    emitReady() {
        this.onmessage?.({ data: { ready: true } } as MessageEvent)
    }
}

describe('gomoku-rapfi', () => {
    afterEach(() => {
        disposeRapfi()
        vi.unstubAllGlobals()
    })

    it('talks Piskvork protocol and maps Rapfi (x,y) to {row,col}', async () => {
        const created: { current: MockRapfiWorker | null } = { current: null }
        vi.stubGlobal(
            'Worker',
            class {
                constructor(url: string | URL) {
                    const instance = new MockRapfiWorker(url)
                    created.current = instance
                    queueMicrotask(() => instance.emitReady())
                    return instance
                }
            },
        )

        const movePromise = chooseRapfiMove(
            [
                { row: 7, col: 6 },
                { row: 8, col: 8 },
            ],
            'easy',
        )

        await expect(movePromise).resolves.toEqual({ row: 7, col: 7 })
        expect(created.current?.url).toBe(RAPFI_WORKER_URL)
        expect(created.current?.commands.some((c: string) => c.startsWith('START 15'))).toBe(
            true,
        )
        expect(created.current?.commands.some((c: string) => c === 'INFO STRENGTH 25')).toBe(
            true,
        )
        expect(
            created.current?.commands.some((c: string) =>
                c.includes('YXBOARD 6,7,1 8,8,2 DONE'),
            ),
        ).toBe(true)
        expect(created.current?.commands.some((c: string) => c.startsWith('YXNBEST'))).toBe(
            true,
        )
    })
})
