import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DIFFICULTIES, useMinesweeper } from './use-minesweeper'
import { createEmptyMinesweeperStats } from '@/lib/playground/minesweeper-stats'

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn((_key: string): unknown => null),
    setPlaygroundItemMock: vi.fn(),
}))

vi.mock('@/lib/playground/storage', () => ({
    getPlaygroundItem: getPlaygroundItemMock,
    setPlaygroundItem: setPlaygroundItemMock,
}))

const originalBeginner = { ...DIFFICULTIES.beginner }
const originalIntermediate = { ...DIFFICULTIES.intermediate }

describe('useMinesweeper', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getPlaygroundItemMock.mockImplementation(() => null)
        DIFFICULTIES.beginner = { ...originalBeginner }
        DIFFICULTIES.intermediate = { ...originalIntermediate }
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        DIFFICULTIES.beginner = { ...originalBeginner }
        DIFFICULTIES.intermediate = { ...originalIntermediate }
    })

    it('keeps the first click safe when the full surrounding safe zone would exceed the board bounds', async () => {
        DIFFICULTIES.beginner = { rows: 2, cols: 2, mines: 3 }
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

        try {
            const { result } = renderHook(() => useMinesweeper('beginner'))

            act(() => {
                result.current.revealCell(0, 0)
            })

            await waitFor(() => expect(result.current.status).toBe('won'))
            expect(result.current.board[0][0]).toMatchObject({
                isMine: false,
                isRevealed: true,
            })
        } finally {
            randomSpy.mockRestore()
        }
    })

    it('ignores out-of-bounds actions instead of throwing or mutating state', () => {
        const { result } = renderHook(() => useMinesweeper('beginner'))
        const initialBoard = result.current.board

        expect(() => {
            act(() => {
                result.current.revealCell(-1, 0)
                result.current.toggleFlag(99, 99)
                result.current.autoReveal(9, 9)
            })
        }).not.toThrow()

        expect(result.current.status).toBe('idle')
        expect(result.current.board).toBe(initialBoard)
    })

    it('allows flagging cells before the first reveal', () => {
        const { result } = renderHook(() => useMinesweeper('beginner'))

        act(() => {
            result.current.toggleFlag(0, 0)
        })

        expect(result.current.status).toBe('idle')
        expect(result.current.board[0][0].isFlagged).toBe(true)
        expect(result.current.minesLeft).toBe(DIFFICULTIES.beginner.mines - 1)
    })

    it('uses an empty stats snapshot for SSR-safe initial rendering', () => {
        expect(createEmptyMinesweeperStats()).toMatchObject({
            totalGames: 0,
            wins: 0,
            winsByDifficulty: {
                beginner: 0,
                intermediate: 0,
                expert: 0,
            },
            bestTimes: {},
        })
    })

    it('loads legacy best time records after mount', async () => {
        getPlaygroundItemMock.mockImplementation((key: string) => {
            if (key === 'minesweeper_best_times') return { beginner: 0, expert: 120 }
            return null
        })

        const { result } = renderHook(() => useMinesweeper('beginner'))

        await waitFor(() => expect(result.current.stats).toMatchObject({
            totalGames: 2,
            wins: 2,
            winsByDifficulty: {
                beginner: 1,
                expert: 1,
            },
            bestTimes: {
                beginner: 1,
                expert: 120,
            },
        }))
    })

    it('resets elapsed time when changing difficulty before saving a new best record', async () => {
        vi.useFakeTimers()
        DIFFICULTIES.beginner = { rows: 2, cols: 2, mines: 1 }
        DIFFICULTIES.intermediate = { rows: 1, cols: 2, mines: 1 }
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999)

        try {
            const { result } = renderHook(() => useMinesweeper('beginner'))

            act(() => {
                result.current.revealCell(0, 0)
            })

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000)
            })

            expect(result.current.time).toBe(2)

            act(() => {
                result.current.revealCell(1, 0)
            })

            act(() => {
                result.current.revealCell(1, 1)
            })

            expect(result.current.status).toBe('won')
            expect(setPlaygroundItemMock).toHaveBeenCalledWith('minesweeper_stats', expect.objectContaining({
                totalGames: 1,
                wins: 1,
                winsByDifficulty: expect.objectContaining({ beginner: 1 }),
                bestTimes: { beginner: 2 },
            }))

            act(() => {
                result.current.changeDifficulty('intermediate')
            })

            await act(async () => {})
            expect(result.current.status).toBe('idle')
            expect(result.current.time).toBe(0)
            expect(result.current.difficultyName).toBe('intermediate')

            act(() => {
                result.current.revealCell(0, 1)
            })

            expect(result.current.status).toBe('won')
            expect(result.current.time).toBe(1)
            expect(setPlaygroundItemMock).toHaveBeenCalledWith('minesweeper_stats', expect.objectContaining({
                totalGames: 2,
                wins: 2,
                winsByDifficulty: expect.objectContaining({ beginner: 1, intermediate: 1 }),
                bestTimes: {
                    beginner: 2,
                    intermediate: 1,
                },
            }))
        } finally {
            randomSpy.mockRestore()
        }
    })
})
