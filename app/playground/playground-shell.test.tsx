import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaygroundShell from './playground-shell'

const navigation = vi.hoisted(() => ({ pathname: '/playground' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))
vi.mock('@/hooks/playground/use-playground-sync', () => ({ usePlaygroundSync: () => undefined }))

beforeEach(() => { navigation.pathname = '/playground' })

describe('playground navigation', () => {
    it('omits retired directory entries and collapses secondary games', () => {
        const { container } = render(<PlaygroundShell><p>页面内容</p></PlaygroundShell>)
        expect(container.querySelector('a[href="/playground/quickmath"]')).toBeNull()
        const secondary = container.querySelector('a[href="/playground/2048"]')!.closest('details')!
        expect(secondary.open).toBe(false)
        expect(container.querySelector('a[href="/playground/tangram"]')!.closest('details')).toBeNull()
    })

    it('opens secondary navigation when visiting one of its direct routes', () => {
        navigation.pathname = '/playground/sudoku'
        const { container } = render(<PlaygroundShell><p>数独内容</p></PlaygroundShell>)
        const active = container.querySelector('a[href="/playground/sudoku"][aria-current="page"]')!
        expect(active.closest('details')!.open).toBe(true)
    })

    it('retains the title and help for the quick-math direct route', () => {
        navigation.pathname = '/playground/quickmath'
        render(<PlaygroundShell><p>速算内容</p></PlaygroundShell>)
        expect(screen.getByRole('heading', { name: '速算闪电战' })).toBeInTheDocument()
        expect(screen.getByText('速算内容')).toBeInTheDocument()
    })
})
