import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FollowButton } from './follow-button'

const mockFollow = vi.fn()
const mockUnfollow = vi.fn()
const mockPromptLogin = vi.fn()

vi.mock('@/hooks/use-follow', () => ({
    useFollow: vi.fn(() => ({
        isFollowing: false,
        isLoading: false,
        followerCount: 10,
        follow: mockFollow,
        unfollow: mockUnfollow,
        isPending: false,
    })),
}))

vi.mock('@/context/auth-context', () => ({
    useAuth: vi.fn(() => ({ user: { id: 'current-user' } })),
}))

vi.mock('@/context/login-prompt-context', () => ({
    useLoginPrompt: vi.fn(() => ({ promptLogin: mockPromptLogin })),
}))

describe('FollowButton', () => {
    it('renders follow button correctly', () => {
        render(<FollowButton targetUserId="target-user" />)
        expect(screen.getByText('关注')).toBeInTheDocument()
    })

    it('triggers follow action on click', () => {
        render(<FollowButton targetUserId="target-user" />)
        fireEvent.click(screen.getByRole('button'))
        expect(mockFollow).toHaveBeenCalled()
    })
})
