import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaygroundShell from './playground-shell'

const navigation = vi.hoisted(() => ({ pathname: '/playground', account: '登录' }))
const userButton = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))
vi.mock('@/hooks/playground/use-playground-sync', () => ({ usePlaygroundSync: () => undefined }))
vi.mock('@/components/layout/user-button', () => ({
    UserButton: (props: { compact?: boolean }) => {
        userButton(props)
        return <button>{navigation.account}</button>
    },
}))

beforeEach(() => {
    navigation.pathname = '/playground'
    navigation.account = '登录'
    userButton.mockClear()
})

describe('playground navigation', () => {
    it.each(['/playground', '/playground/24game'])(
        'provides main-site return and the shared compact account control on %s',
        (pathname) => {
            navigation.pathname = pathname
            render(<PlaygroundShell><p>页面内容</p></PlaygroundShell>)
            const siteNavigation = screen.getByRole('navigation', { name: '主站与账号导航' })
            const back = pathname === '/playground' ? { name: '返回项目', href: '/explore' } : { name: '返回游乐场首页', href: '/playground' }
            expect(within(siteNavigation).getByRole('link', { name: back.name })).toHaveAttribute('href', back.href)
            expect(within(siteNavigation).getByRole('button', { name: '登录' })).toBeInTheDocument()
            expect(userButton).toHaveBeenCalledWith({ compact: true })
            expect(within(siteNavigation).getByRole('button', { name: '登录' }).parentElement).toHaveClass('md:hidden')
        },
    )

    it('preserves the game title, help and playground return alongside main-site navigation', () => {
        navigation.pathname = '/playground/24game'
        render(<PlaygroundShell><p>游戏内容</p></PlaygroundShell>)
        expect(screen.getByRole('heading', { name: '24 点' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '返回游乐场首页' })).toHaveAttribute('href', '/playground')
        expect(screen.getByRole('button', { name: '24 点玩法说明' })).toBeInTheDocument()
        expect(screen.getAllByRole('navigation', { name: '游乐场游戏导航' })).toHaveLength(2)
    })

    it('leaves physics navigation and account controls to the main-site shell', () => {
        navigation.pathname = '/playground/physics-lab'
        render(<PlaygroundShell><p>物理工作区</p></PlaygroundShell>)
        expect(screen.queryByRole('navigation', { name: '主站与账号导航' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '返回游乐场' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '返回项目' })).not.toBeInTheDocument()
        expect(userButton).not.toHaveBeenCalled()
        expect(screen.getByText('物理工作区')).toBeInTheDocument()
        expect(screen.queryByRole('heading')).not.toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: '游乐场游戏导航' })).not.toBeInTheDocument()
        expect(screen.queryByText('本局目标')).not.toBeInTheDocument()
    })

    it('keeps game progress mounted when the shared account changes', () => {
        navigation.pathname = '/playground/24game'
        function Game() {
            const [moves, setMoves] = useState(0)
            return <button onClick={() => setMoves(moves + 1)}>步数 {moves}</button>
        }
        const { rerender } = render(<PlaygroundShell><Game /></PlaygroundShell>)
        fireEvent.click(screen.getByRole('button', { name: '步数 0' }))
        navigation.account = '我的账号'
        rerender(<PlaygroundShell><Game /></PlaygroundShell>)
        expect(screen.getByRole('button', { name: '我的账号' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '步数 1' })).toBeInTheDocument()
    })

    it('omits retired directory entries and collapses secondary games', () => {
        const { container } = render(<PlaygroundShell><p>页面内容</p></PlaygroundShell>)
        for (const slug of ['2048', 'fifteen', 'quickmath']) {
            expect(container.querySelector(`a[href="/playground/${slug}"]`)).toBeNull()
        }
        const secondary = container.querySelector('a[href="/playground/sudoku"]')!.closest('details')!
        expect(secondary.open).toBe(false)
        expect(container.querySelector('a[href="/playground/balance"]')!.closest('details')).toBeNull()
    })

    it('opens secondary navigation when visiting one of its direct routes', () => {
        navigation.pathname = '/playground/sudoku'
        const { container } = render(<PlaygroundShell><p>数独内容</p></PlaygroundShell>)
        const active = container.querySelector('a[href="/playground/sudoku"][aria-current="page"]')!
        expect(active.closest('details')!.open).toBe(true)
    })

    it('keeps Function Wars navigation and title while letting the game own its guidance', () => {
        navigation.pathname = '/playground/functionwars'
        render(<PlaygroundShell><p>函数控制台</p></PlaygroundShell>)
        const compactNavigation = screen.getByRole('navigation', { name: '主站与账号导航' })
        expect(within(compactNavigation).getByRole('link', { name: '返回游乐场首页' })).toHaveAttribute('href', '/playground')
        expect(within(compactNavigation).getByRole('button', { name: '登录' })).toBeInTheDocument()
        expect(within(compactNavigation).getByRole('heading', { name: '函数战争' })).toBeInTheDocument()
        expect(within(compactNavigation).getByRole('button', { name: '函数战争玩法说明' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '函数战争' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '返回游乐场首页' })).toBeInTheDocument()
        expect(screen.queryByText('本局提示')).not.toBeInTheDocument()
        expect(screen.getByText('函数控制台')).toBeInTheDocument()
    })

})
