import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { use2048 } from './use2048'

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn(() => null),
    setPlaygroundItemMock: vi.fn(),
}))

vi.mock('@/lib/playground/storage', () => ({
    getPlaygroundItem: getPlaygroundItemMock,
    setPlaygroundItem: setPlaygroundItemMock,
}))

describe('use2048', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps cumulative score and undo snapshot correct across rapid moves', async () => {
        const randomValues = [0, 0, 0, 0, 0, 0.95, 0, 0]
        const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
            const value = randomValues.shift()
            if (value === undefined) {
                throw new Error('Math.random exhausted during test')
            }
            return value
        })

        try {
            const { result } = renderHook(() => use2048())

            await waitFor(() => expect(result.current.status).toBe('playing'))

            act(() => {
                result.current.move('left')
                result.current.move('left')
            })

            await waitFor(() => expect(result.current.score).toBe(12))
            expect(result.current.canUndo).toBe(true)

            act(() => {
                result.current.undo()
            })

            await waitFor(() => expect(result.current.score).toBe(4))
        } finally {
            randomSpy.mockRestore()
        }
    })

    it('restores win state on undo and allows winning again', async () => {
        const randomValues = [0, 0, 0, 0]
        const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
            const value = randomValues.shift()
            if (value === undefined) {
                throw new Error('Math.random exhausted during test')
            }
            return value
        })

        try {
            const { result } = renderHook(() =>
                use2048({
                    initialGame: {
                        grid: [
                            [1024, 1024, 0, 0],
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                        ],
                        score: 100,
                        status: 'playing',
                    },
                })
            )

            await waitFor(() => expect(result.current.status).toBe('playing'))

            act(() => {
                result.current.move('left')
            })

            await waitFor(() => expect(result.current.status).toBe('won'))
            expect(result.current.score).toBe(2148)
            expect(result.current.canUndo).toBe(true)
            expect(result.current.stats.wins).toBe(1)

            act(() => {
                result.current.undo()
            })

            await waitFor(() => expect(result.current.status).toBe('playing'))
            expect(result.current.score).toBe(100)
            expect(result.current.stats.wins).toBe(0)

            act(() => {
                result.current.move('left')
            })

            await waitFor(() => expect(result.current.status).toBe('won'))
            expect(result.current.score).toBe(2148)
            expect(result.current.stats.wins).toBe(1)
        } finally {
            randomSpy.mockRestore()
        }
    })

    it('restores gameover stats when undo rewinds the losing move', async () => {
        const randomValues = [0, 0]
        const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
            const value = randomValues.shift()
            if (value === undefined) {
                throw new Error('Math.random exhausted during test')
            }
            return value
        })

        try {
            const { result } = renderHook(() =>
                use2048({
                    initialGame: {
                        grid: [
                            [2, 4, 8, 16],
                            [32, 64, 128, 256],
                            [512, 1024, 2, 4],
                            [8, 16, 32, 0],
                        ],
                        score: 64,
                        status: 'playing',
                        stats: {
                            bestScore: 64,
                            totalGames: 0,
                            wins: 0,
                            maxTile: 1024,
                        },
                    },
                })
            )

            await waitFor(() => expect(result.current.status).toBe('playing'))

            act(() => {
                result.current.move('right')
            })

            await waitFor(() => expect(result.current.status).toBe('gameover'))
            expect(result.current.stats.totalGames).toBe(1)

            act(() => {
                result.current.undo()
            })

            await waitFor(() => expect(result.current.status).toBe('playing'))
            expect(result.current.score).toBe(64)
            expect(result.current.stats.totalGames).toBe(0)
        } finally {
            randomSpy.mockRestore()
        }
    })
})
