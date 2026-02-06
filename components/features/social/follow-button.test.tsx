import { render, screen, fireEvent } from '@testing-library/react'
import { FollowButton } from './follow-button'
import '@testing-library/jest-dom'

// Mock hooks
const mockFollow = jest.fn()
const mockUnfollow = jest.fn()
const mockPromptLogin = jest.fn()

jest.mock('@/hooks/use-follow', () => ({
    useFollow: jest.fn(() => ({
        isFollowing: false,
        isLoading: false,
        followerCount: 10,
        follow: mockFollow,
        unfollow: mockUnfollow,
        isPending: false
    }))
}))

jest.mock('@/context/auth-context', () => ({
    useAuth: jest.fn(() => ({ user: { id: 'current-user' } }))
}))

jest.mock('@/context/login-prompt-context', () => ({
    useLoginPrompt: jest.fn(() => ({ promptLogin: mockPromptLogin }))
}))

// We need to re-require modules to change mock implementations between tests if needed, 
// but for simple cases, we can use jest.spyOn or complex mocks. 
// For now, let's test basic rendering and click interaction.

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
