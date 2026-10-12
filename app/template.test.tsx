import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))

let Template: typeof import('./template').default

function endAnimation(element: Element, animationName = 'route-enter') {
    const event = createEvent.animationEnd(element, { bubbles: true })
    Object.defineProperty(event, 'animationName', { value: animationName })
    fireEvent(element, event)
}

function navigate() {
    const view = render(<Template><button>Page action</button></Template>)
    vi.mocked(usePathname).mockReturnValue('/project/1')
    view.rerender(<Template><button>Page action</button></Template>)
    return { ...view, wrapper: view.container.firstElementChild! }
}

describe('route transition template', () => {
    beforeEach(async () => {
        // Each test starts a fresh app session, including the cross-remount pathname.
        vi.resetModules()
        vi.mocked(usePathname).mockReturnValue('/')
        Template = (await import('./template')).default
    })

    it('does not animate the first render', () => {
        const { container } = render(<Template>Page</Template>)
        expect(container.firstElementChild).not.toHaveAttribute('class')
    })

    it('animates a pathname change until its own entry animation ends', () => {
        const { wrapper, rerender } = navigate()
        expect(wrapper).toHaveClass('route-transition-enter')

        rerender(<Template><button>Updated page action</button></Template>)
        expect(wrapper).toHaveClass('route-transition-enter')

        endAnimation(wrapper)
        expect(wrapper).not.toHaveAttribute('class')

        rerender(<Template>Updated page</Template>)
        expect(wrapper).not.toHaveAttribute('class')

        vi.mocked(usePathname).mockReturnValue('/project/2')
        rerender(<Template>Next page</Template>)
        expect(wrapper).toHaveClass('route-transition-enter')
    })

    it('ignores animationend bubbling from a child even with the same animation name', () => {
        const { wrapper } = navigate()
        endAnimation(screen.getByRole('button', { name: 'Page action' }))
        expect(wrapper).toHaveClass('route-transition-enter')
    })

    it('ignores a different animation ending on the wrapper', () => {
        const { wrapper } = navigate()
        endAnimation(wrapper, 'float')
        expect(wrapper).toHaveClass('route-transition-enter')
    })

    it('also animates navigation when Next.js remounts the template', () => {
        const first = render(<Template>First page</Template>)
        first.unmount()
        vi.mocked(usePathname).mockReturnValue('/project/1')

        const { container } = render(<Template>Next page</Template>)
        const wrapper = container.firstElementChild!
        expect(wrapper).toHaveClass('route-transition-enter')
        endAnimation(wrapper)
        expect(wrapper).not.toHaveAttribute('class')
    })
})
