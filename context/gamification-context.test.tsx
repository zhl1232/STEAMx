import { render, screen, act } from '@testing-library/react'
import { GamificationProvider, useGamification } from './gamification-context'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock dependencies
const mockUpdateXpMutation = { mutate: jest.fn() }
const mockUnlockBadgeMutation = { mutate: jest.fn() }
const mockRefetchStats = jest.fn()
const mockToast = jest.fn()

jest.mock('@/hooks/gamification/use-gamification-data', () => ({
    useGamificationData: jest.fn(() => ({
        xp: 100,
        unlockedBadges: new Set(),
        userStats: { totalProjects: 0, totalLikes: 0 },
        updateXpMutation: mockUpdateXpMutation,
        unlockBadgeMutation: mockUnlockBadgeMutation,
        refetchStats: mockRefetchStats
    }))
}))

jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast })
}))

jest.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null }),
            insert: jest.fn().mockResolvedValue({ error: null })
        })),
        rpc: jest.fn().mockResolvedValue({ error: null })
    })
}))

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: { id: 'test-user' } })
}))

// Mock canvas-confetti
jest.mock('canvas-confetti', () => ({
    default: jest.fn()
}))

function TestComponent() {
    const { xp, level, addXp } = useGamification()
    return (
        <div>
            <div data-testid="xp">XP: {xp}</div>
            <div data-testid="level">Level: {level}</div>
            <button onClick={() => addXp(50, 'Test', 'test_action', '1')}>Add XP</button>
        </div>
    )
}

describe('GamificationContext', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })


    it('provides initial gamification data', () => {
        render(
            <QueryClientProvider client={queryClient}>
                <GamificationProvider>
                    <TestComponent />
                </GamificationProvider>
            </QueryClientProvider>
        )
        expect(screen.getByTestId('xp')).toHaveTextContent('XP: 100')
        // sqrt(100/100) + 1 = 2
        expect(screen.getByTestId('level')).toHaveTextContent('Level: 2')
    })

    it('addXp triggers mutation', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <GamificationProvider>
                    <TestComponent />
                </GamificationProvider>
            </QueryClientProvider>
        )

        await act(async () => {
            screen.getByText('Add XP').click()
        })

        expect(mockUpdateXpMutation.mutate).toHaveBeenCalledWith(150) // 100 + 50
    })
})
