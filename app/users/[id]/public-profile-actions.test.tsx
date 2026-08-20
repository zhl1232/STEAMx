import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicProfileActions } from './public-profile-actions'

let mockUser: { id: string } | null = { id: '11111111-1111-1111-1111-111111111111' }
let mockIsFollowing = false
let mockIsFollowedBy = false
let mockIsLoading = false
let mockBlocked = false
let mockBlockedByMe = false

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
    isFollowedBy: mockIsFollowedBy,
    isMutualFollow: mockIsFollowing && mockIsFollowedBy,
    isLoading: mockIsLoading,
  }),
}))

vi.mock('@/hooks/use-block', () => ({
  useBlock: () => ({
    blocked: mockBlocked,
    blockedByMe: mockBlockedByMe,
    isLoading: false,
    isPending: false,
    toggleBlock: vi.fn(),
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
    mockIsFollowedBy = false
    mockIsLoading = false
    mockBlocked = false
    mockBlockedByMe = false
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

  it('asks strangers to wait for a follow back before messaging followers-only users', () => {
    render(
      <PublicProfileActions
        targetUserId="22222222-2222-2222-2222-222222222222"
        messagePrivacy="followers_only"
      />,
    )

    expect(screen.getByRole('button', { name: /互相关注后可私信/ })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /发私信/ })).not.toBeInTheDocument()
  })

  it('keeps followers-only locked when only the current user follows', () => {
    mockIsFollowing = true

    render(
      <PublicProfileActions
        targetUserId="22222222-2222-2222-2222-222222222222"
        messagePrivacy="followers_only"
      />,
    )

    expect(screen.getByRole('button', { name: /互相关注后可私信/ })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /发私信/ })).not.toBeInTheDocument()
  })

  it('links to the conversation once both sides follow each other', () => {
    mockIsFollowing = true
    mockIsFollowedBy = true

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

  it('explains when the current user blocked the profile', () => {
    mockBlocked = true
    mockBlockedByMe = true

    render(
      <PublicProfileActions
        targetUserId="22222222-2222-2222-2222-222222222222"
        messagePrivacy="everyone"
      />,
    )

    expect(screen.getByText('你已屏蔽该用户，暂时无法互动')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '你已屏蔽该用户' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '你已屏蔽该用户，无法发送私信' })).toBeDisabled()
  })

  it('explains when the profile blocked the current user', () => {
    mockBlocked = true

    render(
      <PublicProfileActions
        targetUserId="22222222-2222-2222-2222-222222222222"
        messagePrivacy="everyone"
      />,
    )

    expect(screen.getByText('你已被该用户屏蔽，暂时无法互动')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '你已被该用户屏蔽' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '你已被该用户屏蔽，无法发送私信' })).toBeDisabled()
  })

  it('renders edit profile and share buttons when viewing own profile', () => {
    mockUser = { id: '11111111-1111-1111-1111-111111111111' }

    render(
      <PublicProfileActions
        targetUserId="11111111-1111-1111-1111-111111111111"
        messagePrivacy="everyone"
      />,
    )

    expect(screen.getByRole('link', { name: /编辑资料/ })).toHaveAttribute('href', '/settings/profile')
    expect(screen.getByRole('button', { name: /分享主页/ })).toBeInTheDocument()
  })

  it('renders more options menu button for other users', () => {
    render(
      <PublicProfileActions
        targetUserId="22222222-2222-2222-2222-222222222222"
        messagePrivacy="everyone"
      />,
    )

    expect(screen.getByRole('button', { name: /更多操作/ })).toBeInTheDocument()
  })
})
