import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TutorToolHandlerContext } from '@/components/features/tutor/tool-handler-registry'

const { revealCellMock, toggleFlagMock } = vi.hoisted(() => ({
  revealCellMock: vi.fn(),
  toggleFlagMock: vi.fn(),
}))

const registerToolHandlers = vi.fn((_handlers: TutorToolHandlerContext) => {
  return vi.fn()
})
const setTutorOverride = vi.fn()
const clearTutorOverride = vi.fn()

vi.mock('@/components/features/tutor/tutor-context', () => ({
  useTutorContext: () => ({
    registerToolHandlers,
    setOverride: setTutorOverride,
    clearOverride: clearTutorOverride,
  }),
}))

vi.mock('@/lib/context/gamification-context', () => ({
  useGamification: () => ({ checkBadges: vi.fn() }),
}))

vi.mock('@/hooks/playground/use-minesweeper', () => {
  const minesweeperState = {
    board: [
      [
        { row: 0, col: 0, isMine: true, isRevealed: false, isFlagged: true, neighborMines: 0 },
        { row: 0, col: 1, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 1 },
      ],
      [
        { row: 1, col: 0, isMine: false, isRevealed: true, isFlagged: false, neighborMines: 1 },
        { row: 1, col: 1, isMine: false, isRevealed: true, isFlagged: false, neighborMines: 1 },
      ],
    ],
    status: 'playing',
    time: 12,
    minesLeft: 0,
    revealCell: revealCellMock,
    toggleFlag: toggleFlagMock,
    resetGame: vi.fn(),
    changeDifficulty: vi.fn(),
    difficultyName: 'beginner',
    autoReveal: vi.fn(),
    stats: { totalGames: 1, wins: 0, winsByDifficulty: {}, bestTimes: {} },
    bestTimes: {},
    isNewRecord: false,
  }

  return {
    DIFFICULTIES: {
      beginner: { rows: 9, cols: 9, mines: 10 },
      intermediate: { rows: 16, cols: 16, mines: 40 },
      expert: { rows: 16, cols: 30, mines: 99 },
    },
    useMinesweeper: () => minesweeperState,
  }
})

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

import MinesweeperPage from '@/app/playground/minesweeper/page'

describe('MinesweeperPage tutor hint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses only visible board state to highlight the evidence cell without revealing the answer', async () => {
    render(<MinesweeperPage />)
    const handlers = registerToolHandlers.mock.calls.at(-1)?.[0]
    expect(handlers?.hintMinesweeperCell).toBeTypeOf('function')

    await act(async () => {
      await handlers?.hintMinesweeperCell?.({
        name: 'playground.hint_minesweeper',
        payload: { reason: 'stuck' },
      })
    })

    expect(screen.getByRole('status')).toHaveTextContent('第 2 行第 1 列')
    expect(screen.getByRole('status')).toHaveTextContent('这个数字还需要新的雷吗')
    expect(screen.getByRole('status')).not.toHaveTextContent('第 1 行第 2 列')
    const evidenceCell = document.getElementById('minesweeper-cell-1-0')
    expect(evidenceCell).toHaveAttribute('aria-describedby', 'minesweeper-hint-feedback')
    expect(evidenceCell).toHaveAttribute('aria-label', expect.stringContaining('小迪提示从这里推理'))
    expect(evidenceCell).toHaveClass('ring-yellow-400')
    expect(evidenceCell).not.toHaveClass('animate-pulse')
    expect(document.getElementById('minesweeper-cell-0-1')).not.toHaveAttribute('aria-describedby')
    expect(setTutorOverride).toHaveBeenCalledWith(expect.objectContaining({
      sceneCapabilities: ['hintMinesweeperCell'],
    }))
  })

  it('keeps a touch long press active through small finger movement and suppresses the follow-up click', () => {
    vi.useFakeTimers()
    render(<MinesweeperPage />)
    const cell = document.getElementById('minesweeper-cell-0-1')
    expect(cell).not.toBeNull()

    fireEvent.pointerDown(cell!, { pointerType: 'touch', pointerId: 7, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(cell!, { pointerType: 'touch', pointerId: 7, clientX: 27, clientY: 27 })
    act(() => vi.advanceTimersByTime(420))
    fireEvent.pointerUp(cell!, { pointerType: 'touch', pointerId: 7, clientX: 27, clientY: 27 })
    fireEvent.click(cell!)

    expect(toggleFlagMock).toHaveBeenCalledWith(0, 1)
    expect(revealCellMock).not.toHaveBeenCalled()
  })

  it('toggles the mobile action mode when tapping anywhere on the mode control', () => {
    render(<MinesweeperPage />)
    const modeToggle = screen.getByTestId('minesweeper-mobile-mode-toggle')

    expect(modeToggle).toHaveAttribute('aria-pressed', 'false')
    expect(modeToggle).toHaveTextContent('挖')

    fireEvent.click(modeToggle)
    expect(modeToggle).toHaveAttribute('aria-pressed', 'true')
    expect(modeToggle).toHaveTextContent('旗')

    fireEvent.click(modeToggle)
    expect(modeToggle).toHaveAttribute('aria-pressed', 'false')
    expect(modeToggle).toHaveTextContent('挖')
  })

  it('cancels a pending long press when the finger movement becomes a swipe', () => {
    vi.useFakeTimers()
    render(<MinesweeperPage />)
    const cell = document.getElementById('minesweeper-cell-0-1')
    expect(cell).not.toBeNull()

    fireEvent.pointerDown(cell!, { pointerType: 'touch', pointerId: 8, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(cell!, { pointerType: 'touch', pointerId: 8, clientX: 40, clientY: 20 })
    act(() => vi.advanceTimersByTime(420))

    expect(toggleFlagMock).not.toHaveBeenCalled()
  })
})
