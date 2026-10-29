import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChallengeOnlineView } from './challenge-online-view'

const mock = vi.hoisted(() => ({ value: {} as Record<string, unknown>, command: vi.fn(), action: vi.fn() }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'user' } }) }))
vi.mock('@/hooks/playground/use-challenge', () => ({ useChallenge: () => mock.value }))
vi.mock('./gomoku-board', () => ({ GomokuBoard: () => <div>棋盘</div> }))
beforeEach(() => {
  vi.clearAllMocks()
  mock.value = { challenge: null, remaining: 5, error: '', busy: false, clockOffset: 0, command: mock.command, action: mock.action, reset: vi.fn() }
})
describe('challenge online entry', () => {
  it('offers free invitations and a separate paid random challenge', () => {
    render(<ChallengeOnlineView game="memory" />)
    fireEvent.click(screen.getByRole('button', { name: '随机挑战 · 2 硬币' }))
    expect(mock.command).toHaveBeenCalledWith('queue')
    fireEvent.click(screen.getByRole('button', { name: '创建房间' }))
    expect(mock.command).toHaveBeenCalledWith('invite', { theme: 'optics', pairCount: 6 })
  })
  it('does not offer a computer until the three second real-player search finishes', () => {
    mock.value.challenge = { id: 'q', mode: 'random', status: 'waiting', createdAt: Date.now(), state: {} }
    render(<ChallengeOnlineView game="gomoku" />)
    expect(screen.getByRole('status').textContent).toContain('寻找对手 · 3')
    expect(screen.queryByRole('button', { name: '挑战电脑 · 2 硬币' })).toBeNull()
  })
  it('allows explicit computer choice after the search window', () => {
    mock.value.challenge = { id: 'q', mode: 'random', status: 'waiting', createdAt: Date.now() - 3100, state: {} }
    render(<ChallengeOnlineView game="gomoku" />)
    fireEvent.click(screen.getByRole('button', { name: '挑战电脑 · 2 硬币' }))
    expect(mock.command).toHaveBeenCalledWith('bot')
  })
  it('allows independent memory flips without waiting for an opponent turn and hides card content', () => {
    mock.value.challenge = { id: 'm', status: 'playing', myRole: 'host', state: { currentTurn: 1, cards: [{ id: 'opaque', matched: false, open: false }], pairCount: 6 } }
    render(<ChallengeOnlineView game="memory" />)
    fireEvent.click(screen.getByRole('button', { name: '第 1 张牌' }))
    expect(mock.action).toHaveBeenCalledWith('flip', { cardId: 'opaque' })
    expect(screen.queryByText('轮到你翻牌')).toBeNull()
  })
})
