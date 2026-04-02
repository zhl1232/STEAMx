import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGamificationData } from './use-gamification-data'

const mockRefreshProfile = vi.fn()
const mockBadgeSelectEq = vi.fn()
const mockExistingBadgeEq = vi.fn()
const mockExistingBadgeMaybeSingle = vi.fn()
const mockBadgeUpsert = vi.fn()
const mockBadgeUpsertSelect = vi.fn()
const mockBadgeUpsertMaybeSingle = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/context/auth-context', () => ({
    useAuth: () => ({
        user: { id: 'test-user' },
        profile: { xp: 0 },
        refreshProfile: mockRefreshProfile,
    }),
}))

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: (table: string) => {
            if (table !== 'user_badges') {
                throw new Error(`Unexpected table: ${table}`)
            }

            return {
                select: () => ({
                    eq: mockBadgeSelectEq,
                }),
                upsert: mockBadgeUpsert,
            }
        },
        rpc: mockRpc,
    }),
}))

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
            mutations: {
                retry: false,
            },
        },
    })

    return function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
}

describe('useGamificationData', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        const selectResponses: unknown[] = [
            Promise.resolve({ data: [], error: null }),
            { eq: mockExistingBadgeEq },
        ]

        mockBadgeSelectEq.mockImplementation(() => selectResponses.shift())
        mockExistingBadgeEq.mockReturnValue({
            maybeSingle: mockExistingBadgeMaybeSingle,
        })
        mockExistingBadgeMaybeSingle.mockResolvedValue({
            data: {
                badge_id: 'first_observation',
                unlocked_at: '2026-04-01T00:00:00.000Z',
            },
            error: null,
        })

        mockBadgeUpsertMaybeSingle.mockResolvedValue({
            data: null,
            error: null,
        })
        mockBadgeUpsertSelect.mockReturnValue({
            maybeSingle: mockBadgeUpsertMaybeSingle,
        })
        mockBadgeUpsert.mockReturnValue({
            select: mockBadgeUpsertSelect,
        })

        mockRpc.mockResolvedValue({
            data: {},
            error: null,
        })
    })

    it('treats existing badge unlocks as idempotent and syncs the cache without writing again', async () => {
        const { result } = renderHook(() => useGamificationData(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(mockBadgeSelectEq).toHaveBeenCalled()
        })

        let mutationResult: Awaited<ReturnType<typeof result.current.unlockBadgeMutation.mutateAsync>>

        await act(async () => {
            mutationResult = await result.current.unlockBadgeMutation.mutateAsync('first_observation')
        })

        expect(mockExistingBadgeEq).toHaveBeenCalledWith('badge_id', 'first_observation')
        expect(mockBadgeUpsert).not.toHaveBeenCalled()
        expect(mutationResult!).toMatchObject({
            inserted: false,
            unlockedAt: '2026-04-01T00:00:00.000Z',
        })

        await waitFor(() => {
            expect(result.current.unlockedBadges.has('first_observation')).toBe(true)
            expect(result.current.userBadgeDetails.get('first_observation')).toEqual({
                unlockedAt: '2026-04-01T00:00:00.000Z',
            })
        })
    })

    it('falls back to the existing row when the write is ignored by the database', async () => {
        const selectResponses: unknown[] = [
            Promise.resolve({ data: [], error: null }),
            { eq: mockExistingBadgeEq },
            { eq: mockExistingBadgeEq },
        ]

        mockBadgeSelectEq.mockImplementation(() => selectResponses.shift())
        mockExistingBadgeMaybeSingle
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({
                data: {
                    badge_id: 'first_observation',
                    unlocked_at: '2026-04-01T00:00:00.000Z',
                },
                error: null,
            })

        const { result } = renderHook(() => useGamificationData(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(mockBadgeSelectEq).toHaveBeenCalled()
        })

        let mutationResult: Awaited<ReturnType<typeof result.current.unlockBadgeMutation.mutateAsync>>

        await act(async () => {
            mutationResult = await result.current.unlockBadgeMutation.mutateAsync('first_observation')
        })

        expect(mockBadgeUpsert).toHaveBeenCalledWith(
            {
                user_id: 'test-user',
                badge_id: 'first_observation',
                unlocked_at: expect.any(String),
            },
            {
                onConflict: 'user_id,badge_id',
                ignoreDuplicates: true,
            },
        )
        expect(mockBadgeUpsertSelect).toHaveBeenCalledWith('badge_id, unlocked_at')
        expect(mockBadgeUpsertMaybeSingle).toHaveBeenCalled()
        expect(mutationResult!).toMatchObject({
            inserted: false,
            unlockedAt: '2026-04-01T00:00:00.000Z',
        })
    })
})
