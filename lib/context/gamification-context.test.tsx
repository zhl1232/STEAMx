import { render, screen, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GamificationProvider, useGamification } from './gamification-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockUpdateXpMutation = { mutate: vi.fn() }
const mockUnlockBadgeMutation = { mutate: vi.fn() }
const mockRefetchStats = vi.fn()
const mockToast = vi.fn()
const { mockLoggerError, mockLoggerWarn } = vi.hoisted(() => ({
    mockLoggerError: vi.fn(),
    mockLoggerWarn: vi.fn(),
}))

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

vi.mock('@/lib/logger', () => ({
    logger: {
        error: mockLoggerError,
        warn: mockLoggerWarn,
    },
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

vi.mock('@/lib/context/auth-context', () => ({
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
    const { xp, level, addXp, checkBadges } = useGamification()
    return (
        <div>
            <div data-testid="xp">XP: {xp}</div>
            <div data-testid="level">Level: {level}</div>
            <button type="button" onClick={() => addXp(50)}>
                Add XP
            </button>
            <button
                type="button"
                onClick={() =>
                    checkBadges({
                        projectsPublished: 0,
                        projectsLiked: 0,
                        projectsCompleted: 0,
                        commentsCount: 0,
                        scienceCompleted: 0,
                        techCompleted: 0,
                        engineeringCompleted: 0,
                        artCompleted: 0,
                        mathCompleted: 0,
                        likesGiven: 0,
                        likesReceived: 0,
                        collectionsCount: 0,
                        challengesJoined: 0,
                        level: 1,
                        loginDays: 0,
                        consecutiveDays: 0,
                        discussionsCreated: 0,
                        repliesCount: 0,
                        minesweeperWins: 0,
                        minesweeperExpertWins: 0,
                        minesweeperBestTime: 999,
                        observationsSubmitted: 0,
                        speciesObserved: 0,
                        observationStreak: 0,
                    })
                }
            >
                Check Badges
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

    it('does not show a badge toast when the badge already exists in persistence', async () => {
        mockUnlockBadgeMutation.mutate.mockImplementation((_badgeId, options) => {
            options?.onSuccess?.({ inserted: false, unlockedAt: new Date().toISOString() }, 'first_step', undefined)
        })

        render(
            <QueryClientProvider client={queryClient}>
                <GamificationProvider>
                    <TestComponent />
                </GamificationProvider>
            </QueryClientProvider>,
        )

        await act(async () => {
            screen.getByText('Check Badges').click()
        })

        expect(mockUnlockBadgeMutation.mutate).toHaveBeenCalledWith(
            'first_step',
            expect.objectContaining({
                onSuccess: expect.any(Function),
                onError: expect.any(Function),
            }),
        )
        expect(mockToast).not.toHaveBeenCalled()
    })

    it('stops retrying a badge in the same session when the badge definition is missing in the database', async () => {
        mockUnlockBadgeMutation.mutate.mockImplementation((_badgeId, options) => {
            options?.onError?.(
                {
                    code: '23503',
                    message: 'insert or update on table "user_badges" violates foreign key constraint "user_badges_badge_id_fkey"',
                    details: 'Key is not present in table "badges".',
                },
                'first_step',
                undefined,
            )
        })

        render(
            <QueryClientProvider client={queryClient}>
                <GamificationProvider>
                    <TestComponent />
                </GamificationProvider>
            </QueryClientProvider>,
        )

        await act(async () => {
            screen.getByText('Check Badges').click()
        })

        await act(async () => {
            screen.getByText('Check Badges').click()
        })

        expect(mockUnlockBadgeMutation.mutate).toHaveBeenCalledTimes(1)
        expect(mockLoggerWarn).toHaveBeenCalledWith(
            'Badge definition missing in database: first_step',
            expect.objectContaining({
                context: 'Skipping unlock for badge first_step',
            }),
        )
        expect(mockLoggerError).not.toHaveBeenCalled()
    })
})
