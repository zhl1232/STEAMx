import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicProfileActions } from './public-profile-actions'

let mockUser: { id: string } | null = { id: '11111111-1111-1111-1111-111111111111' }
let mockIsFollowing = false
let mockIsLoading = false

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/features/social/follow-button', () => ({
  FollowButton: () => <button type="button">关注</button>,
}))

vi.mock('@/hooks/use-follow', () => ({
  useFollow: () => ({
    isFollowing: mockIsFollowing,
    isLoading: mockIsLoading,
  }),
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}))

describe('PublicProfileActions', () => {
  beforeEach(() => {
    mockUser = { id: '11111111-1111-1111-1111-111111111111' }
    mockIsFollowing = false
    mockIsLoading = false
  })

  it('disables the message button when the target user closed private messages', () => {
    render(
      <PublicProfileActions
        targetUserId="22222222-2222-2222-2222-222222222222"
        messagePrivacy="nobody"
      />,
    )

    expect(screen.getByRole('button', { name: /对方已关闭私信/ })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /发私信/ })).not.toBeInTheDocument()
  })

  it('asks non-followers to follow before messaging followers-only users', () => {
    render(
      <PublicProfileActions
        targetUserId="22222222-2222-2222-2222-222222222222"
        messagePrivacy="followers_only"
      />,
    )

    expect(screen.getByRole('button', { name: /关注后可私信/ })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /发私信/ })).not.toBeInTheDocument()
  })

  it('links to the conversation when messaging is allowed', () => {
    mockIsFollowing = true

    render(
      <PublicProfileActions
        targetUserId="22222222-2222-2222-2222-222222222222"
        messagePrivacy="followers_only"
      />,
    )

    expect(screen.getByRole('link', { name: /发私信/ })).toHaveAttribute(
      'href',
      '/messages/22222222-2222-2222-2222-222222222222',
    )
  })
})
