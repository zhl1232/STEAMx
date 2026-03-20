import { render, screen, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GamificationProvider, useGamification } from './gamification-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockUpdateXpMutation = { mutate: vi.fn() }
const mockUnlockBadgeMutation = { mutate: vi.fn() }
const mockRefetchStats = vi.fn()
const mockToast = vi.fn()

vi.mock('@/hooks/gamification/use-gamification-data', () => ({
    useGamificationData: vi.fn(() => ({
        xp: 100,
        unlockedBadges: new Set(),
        userBadgeDetails: new Map(),
        badgesLoaded: true,
        userStats: { totalProjects: 0, totalLikes: 0 },
        updateXpMutation: mockUpdateXpMutation,
        unlockBadgeMutation: mockUnlockBadgeMutation,
        refetchStats: mockRefetchStats,
    })),
}))

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            gte: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null }),
            insert: vi.fn().mockResolvedValue({ error: null }),
        })),
        rpc: vi.fn().mockResolvedValue({ error: null }),
    }),
}))

vi.mock('@/context/auth-context', () => ({
    useAuth: () => ({
        user: { id: 'test-user' },
        profile: { coins: 0 },
        refreshProfile: vi.fn(),
    }),
}))

vi.mock('canvas-confetti', () => ({
    default: vi.fn(),
}))

function TestComponent() {
    const { xp, level, addXp } = useGamification()
    return (
        <div>
            <div data-testid="xp">XP: {xp}</div>
            <div data-testid="level">Level: {level}</div>
            <button type="button" onClick={() => addXp(50)}>
                Add XP
            </button>
        </div>
    )
}

describe('GamificationContext', () => {
    beforeEach(() => {
        vi.clearAllMocks()
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
            </QueryClientProvider>,
        )
        expect(screen.getByTestId('xp')).toHaveTextContent('XP: 100')
        expect(screen.getByTestId('level')).toHaveTextContent('Level: 2')
    })

    it('addXp triggers mutation', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <GamificationProvider>
                    <TestComponent />
                </GamificationProvider>
            </QueryClientProvider>,
        )

        await act(async () => {
            screen.getByText('Add XP').click()
        })

        expect(mockUpdateXpMutation.mutate).toHaveBeenCalledWith(50)
    })
})
