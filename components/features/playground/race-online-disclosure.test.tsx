import { useEffect } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RaceOnlineDisclosure, RaceOnlinePanel } from './race-online-panel'

const { auth } = vi.hoisted(() => ({ auth: { user: null as { id: string } | null, loading: false } }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => auth }))

beforeEach(() => { auth.user = null; window.localStorage.clear() })

afterEach(() => window.history.replaceState(null, '', '/'))

describe('RaceOnlineDisclosure', () => {
    it('keeps idle content mounted and allows manual expansion', () => {
        const mount = vi.fn()
        const unmount = vi.fn()
        function Panel() {
            useEffect(() => { mount(); return unmount }, [])
            return <input aria-label="房间码" defaultValue="ABC123" />
        }
        const { container } = render(<RaceOnlineDisclosure phase="idle"><Panel /></RaceOnlineDisclosure>)
        const details = container.querySelector('details')!
        expect(details.open).toBe(false)
        expect(mount).toHaveBeenCalledTimes(1)
        act(() => { details.open = true })
        expect(screen.getByLabelText('房间码')).toHaveValue('ABC123')
        act(() => { details.open = false })
        expect(unmount).not.toHaveBeenCalled()
    })

    it('opens an invitation before authentication or joining begins', () => {
        window.history.replaceState(null, '', '/playground/balance?room=ABC123')
        const { container } = render(<RaceOnlineDisclosure phase="idle"><div>登录后加入</div></RaceOnlineDisclosure>)
        expect(container.querySelector('details')).toHaveAttribute('open')
    })

    it('opens for restored/active rooms, retains content after failure, and prevents hiding an active room', () => {
        const { container, rerender } = render(<RaceOnlineDisclosure phase="idle"><div>房间</div></RaceOnlineDisclosure>)
        const details = container.querySelector('details')!
        for (const phase of ['joining', 'waiting', 'playing', 'finished'] as const) {
            rerender(<RaceOnlineDisclosure phase={phase}><div>房间</div></RaceOnlineDisclosure>)
            expect(details.open).toBe(true)
            act(() => { details.open = false; fireEvent(details, new Event('toggle')) })
            expect(details.open).toBe(true)
        }
        rerender(<RaceOnlineDisclosure phase="idle"><div>重试</div></RaceOnlineDisclosure>)
        expect(details.open).toBe(true)
        expect(screen.getByText('重试')).toBeInTheDocument()
    })
})

describe('collapsible RaceOnlinePanel', () => {
    function online() {
        return {
            phase: 'idle', settings: {}, activeMatchStorageKey: 'test-active-race',
            meta: { settingLabel: () => '测试关卡', objective: '同题竞速' },
            reconnect: vi.fn(), joinRoom: vi.fn(), createRoom: vi.fn(),
        } as unknown as Parameters<typeof RaceOnlinePanel>[0]['online']
    }

    it('collapses an idle login panel on desktop too and preserves the invitation login return', () => {
        const { container, unmount } = render(<RaceOnlinePanel collapsible online={online()} gamePath="/playground/balance" />)
        expect(container.querySelector('details')!.open).toBe(false)
        expect(container.querySelector('details')).not.toHaveClass('xl:hidden')
        unmount()
        window.history.replaceState(null, '', '/playground/balance?room=ABC123')
        const invited = render(<RaceOnlinePanel collapsible online={online()} gamePath="/playground/balance" />)
        expect(invited.container.querySelector('details')!.open).toBe(true)
        expect(screen.getByRole('link', { name: '去登录' })).toHaveAttribute('href', '/login?next=%2Fplayground%2Fbalance%3Froom%3DABC123')
    })

    it('still reconnects while idle content is collapsed', () => {
        auth.user = { id: 'player' }
        window.localStorage.setItem('test-active-race', 'saved-match')
        const race = online()
        const { container } = render(<RaceOnlinePanel collapsible online={race} gamePath="/playground/balance" />)
        expect(container.querySelector('details')!.open).toBe(false)
        expect(race.reconnect).toHaveBeenCalledWith('saved-match')
    })
})
