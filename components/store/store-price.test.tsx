import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StorePrice, useStoreMembershipTier } from './store-price'
import type { MembershipProfile } from '@/lib/membership'

const auth = vi.hoisted(() => ({ profile: null as MembershipProfile | null, user: null as { id: string } | null, loading: false }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => auth }))

function CurrentPrice() {
  return <StorePrice cents={1234} tier={useStoreMembershipTier()} />
}

describe('store membership prices', () => {
  it('keeps the ordinary price for guests and expired members', () => {
    auth.profile = null
    auth.user = null
    auth.loading = false
    const view = render(<CurrentPrice />)
    expect(screen.getByText('¥12.34')).toBeInTheDocument()
    expect(screen.getByText('¥10.86')).toBeInTheDocument()
    expect(view.container.querySelector('del')).toBeNull()
    auth.user = { id: 'member' }
    auth.profile = { membership_tier: 'pro', membership_period: 'monthly', membership_expires_at: '2000-01-01' }
    view.rerender(<CurrentPrice />)
    expect(view.container.querySelector('del')).toBeNull()
    expect(screen.getByText('¥12.34')).toBeInTheDocument()
  })
  it('shows the active tier price with the ordinary price struck through', () => {
    auth.user = { id: 'member' }
    auth.profile = { membership_tier: 'pro', membership_period: 'lifetime' }
    const view = render(<CurrentPrice />)
    expect(screen.getByText('¥10.86')).toBeInTheDocument()
    expect(view.container.querySelector('del')).toHaveTextContent('¥12.34')
    auth.profile = { membership_tier: 'founder', membership_period: 'founder' }
    view.rerender(<CurrentPrice />)
    expect(screen.getByText('¥9.87')).toBeInTheDocument()
    expect(screen.getByText('创始会员价')).toBeInTheDocument()
    auth.user = null
    view.rerender(<CurrentPrice />)
    expect(view.container.querySelector('del')).toBeNull()
    expect(screen.getByText('¥12.34')).toBeInTheDocument()
  })
})
