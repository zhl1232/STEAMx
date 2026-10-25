import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFunctionWarsOnlineMap, createFunctionWarsInitialInventory } from '@/lib/playground/function-wars-online'
import { FunctionWarsOnlineView } from './function-wars-online-view'

const state = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
const rendered = vi.hoisted(() => ({ setScene: vi.fn() }))

vi.mock('@/hooks/playground/use-function-wars-online', () => ({
  useFunctionWarsOnline: () => state.current,
}))
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'test-host' }, loading: false }),
}))
vi.mock('@/app/playground/functionwars/renderer', () => ({
  FUNCTION_WARS_CANVAS_ASPECT_RATIO: 12 / 7,
  FunctionWarsRenderer: class {
    resize() {}
    setScene(scene: unknown) { rendered.setScene(scene) }
    setLabelExclusions() {}
    start() {}
    destroy() {}
  },
}))

function playingState(overrides: Record<string, unknown> = {}) {
  const map = buildFunctionWarsOnlineMap(7)
  return {
    phase: 'playing', matchId: 'test-match', code: 'ABC123', error: null,
    baseMap: map, map, currentTurn: 'host', myRole: 'host', isMyTurn: true,
    winner: null, hp: { host: 80, guest: 60 }, inventory: createFunctionWarsInitialInventory(),
    crates: map.crates, availableCrates: [], repairs: [], craters: [],
    turnDeadlineAt: new Date(Date.now() + 60_000).toISOString(), lastShot: null,
    shotSeq: 4, firing: false, joinRoom: vi.fn(), reconnect: vi.fn(),
    fire: vi.fn(), reset: vi.fn(), leaveRoom: vi.fn(), createRoom: vi.fn(), ...overrides,
  }
}

describe('FunctionWarsOnlineView immersive active match', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    state.current = playingState()
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
  })

  it('draws the existing online collision hole without changing stored blast radii', async () => {
    const craters = [{ x: 2, y: -3, radius: 1.3 }]
    state.current = playingState({ craters })
    render(<FunctionWarsOnlineView immersive />)
    await waitFor(() => expect(rendered.setScene).toHaveBeenLastCalledWith(expect.objectContaining({
      craters: [{ x: 2, y: -3, radius: 1.3 * 0.72 }],
    })))
    expect(craters).toEqual([{ x: 2, y: -3, radius: 1.3 }])
  })

  it('preserves expression, weapon, canvas and shot status when immersive props change', async () => {
    const { rerender } = render(<FunctionWarsOnlineView />)
    const canvas = screen.getByRole('img', { name: '函数战争在线战场' })
    const input = screen.getByRole('textbox', { name: '炮弹轨迹函数' })
    fireEvent.change(input, { target: { value: '0.25*x' } })
    fireEvent.click(screen.getByRole('button', { name: /^重磅/ }))

    rerender(<FunctionWarsOnlineView immersive />)
    expect(screen.getByRole('textbox', { name: '炮弹轨迹函数' })).toBe(input)
    expect(input).toHaveValue('0.25*x')
    expect(screen.getByRole('img', { name: '函数战争在线战场' })).toBe(canvas)
    expect(screen.getByRole('status')).toHaveTextContent('你的回合')
    expect(screen.getByRole('status')).toHaveTextContent('已射 4 发')
    expect(screen.queryByRole('button', { name: /^重磅/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '操作' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '关闭操作' })).toHaveFocus())
    expect(screen.getByRole('button', { name: /^重磅/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '关闭操作' }))
    expect(screen.getByRole('button', { name: '操作' })).toHaveFocus()

    rerender(<FunctionWarsOnlineView immersive={false} />)
    expect(screen.getByRole('textbox', { name: '炮弹轨迹函数' })).toBe(input)
    expect(input).toHaveValue('0.25*x')
    expect(screen.getByRole('img', { name: '函数战争在线战场' })).toBe(canvas)
    expect(screen.getByRole('button', { name: /^重磅/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps opponent turn and HP status readable while firing controls are disabled', () => {
    state.current = playingState({ currentTurn: 'guest', isMyTurn: false })
    render(<FunctionWarsOnlineView immersive />)
    expect(screen.getByRole('status')).toHaveTextContent('对手计算中')
    expect(screen.getByRole('status')).toHaveTextContent('已射 4 发')
    expect(screen.getByRole('img', { name: '函数战争在线战场' })).toHaveAccessibleDescription(/生命值 80\/100[\s\S]*生命值 60\/100/)
    expect(screen.getByRole('textbox', { name: '炮弹轨迹函数' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发射' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '操作' })).toBeEnabled()
  })

  it('shows match results and restart outside the closed operations panel', () => {
    state.current = playingState({ phase: 'finished', winner: 'host', isMyTurn: false })
    render(<FunctionWarsOnlineView immersive />)
    expect(screen.getByRole('status')).toHaveTextContent('任务完成')
    expect(screen.getByRole('button', { name: '再开一局' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: '炮弹轨迹函数' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发射' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '再开一局' }))
    expect(state.current.reset).toHaveBeenCalledOnce()
  })

  it('rejects an invalid origin in the dock without submitting a network shot', () => {
    render(<FunctionWarsOnlineView immersive />)
    fireEvent.change(screen.getByRole('textbox', { name: '炮弹轨迹函数' }), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: '发射' }))
    expect(screen.getByRole('alert')).toHaveTextContent('f(0)=0')
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(state.current.fire).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('已射 4 发')
  })

  it('creates a room using the current hook default map', () => {
    state.current = playingState({ phase: 'idle' })
    render(<FunctionWarsOnlineView immersive />)
    fireEvent.click(screen.getByRole('button', { name: '创建房间' }))
    expect(state.current.createRoom).toHaveBeenCalledExactlyOnceWith()
  })

})
