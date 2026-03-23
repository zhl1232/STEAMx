import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DIFFICULTIES, useMinesweeper } from './useMinesweeper'

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
    getPlaygroundItemMock: vi.fn(() => null),
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
            expect(setPlaygroundItemMock).toHaveBeenLastCalledWith('minesweeper_best_times', { beginner: 2 })

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
            expect(setPlaygroundItemMock).toHaveBeenLastCalledWith('minesweeper_best_times', {
                beginner: 2,
                intermediate: 0,
            })
        } finally {
            randomSpy.mockRestore()
        }
    })
})
