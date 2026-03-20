import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
    it('renders button with text', () => {
        render(<Button>Click me</Button>)
        expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    it('handles click events', async () => {
        const handleClick = vi.fn()
        const user = userEvent.setup()

        render(<Button onClick={handleClick}>Click me</Button>)
        await user.click(screen.getByText('Click me'))

        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('renders with different variants', () => {
        const { rerender } = render(<Button variant="default">Default</Button>)
        expect(screen.getByText('Default')).toHaveClass('bg-primary')

        rerender(<Button variant="outline">Outline</Button>)
        expect(screen.getByText('Outline')).toHaveClass('border-input')
    })

    it('can be disabled', () => {
        render(<Button disabled>Disabled Button</Button>)
        expect(screen.getByText('Disabled Button')).toBeDisabled()
    })
})
