import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalize24Expression, use24Game, validate24Expression } from './use-24-game'

const { getPlaygroundItemMock, setPlaygroundItemMock } = vi.hoisted(() => ({
  getPlaygroundItemMock: vi.fn(() => null),
  setPlaygroundItemMock: vi.fn(),
}))

vi.mock('@/lib/playground/storage', () => ({
  getPlaygroundItem: getPlaygroundItemMock,
  setPlaygroundItem: setPlaygroundItemMock,
}))

describe('24 game expression validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('accepts face-card tokens in expressions', () => {
    expect(normalize24Expression('(K - A) * 2')).toBe('(13 - 1) * 2')

    expect(
      validate24Expression('K + J + A - A', [13, 11, 1, 1]),
    ).toEqual({
      valid: true,
      result: 24,
    })
  })

  it('rejects division by zero with a specific error', () => {
    expect(
      validate24Expression('6/(1-1)+12', [6, 1, 1, 12]),
    ).toEqual({
      valid: false,
      result: 0,
      error: '除数不能为 0',
    })
  })

  it('starts immediately on round 1 with a playable hand', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.39)

    try {
      const { result } = renderHook(() => use24Game())

      expect(result.current.round).toBe(1)
      expect(result.current.status).toBe('playing')
      expect(result.current.cards).toHaveLength(4)
      expect(result.current.timeLeft).toBe(60)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(result.current.timeLeft).toBe(59)
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('resets the displayed round back to 1 when starting a new game', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.39)

    try {
      const { result } = renderHook(() => use24Game())

      act(() => {
        result.current.dealNewRound()
      })

      expect(result.current.round).toBe(2)

      act(() => {
        result.current.newGame()
      })

      expect(result.current.round).toBe(1)
      expect(result.current.status).toBe('playing')
    } finally {
      randomSpy.mockRestore()
    }
  })
})
