import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFollow } from './use-follow'

const mockCreateNotification = vi.fn()
const mockToast = vi.fn()

vi.mock('@/context/auth-context', () => ({
    useAuth: () => ({
        user: {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'tester@example.com',
            user_metadata: {},
        },
        profile: {
            display_name: '测试用户',
            avatar_url: null,
        },
        loading: false,
    }),
}))

vi.mock('@/context/notification-context', () => ({
    useNotifications: () => ({
        createNotification: mockCreateNotification,
    }),
}))

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast: mockToast,
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

    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
}

describe('useFollow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
            const rawUrl = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url
            const pathname = new URL(rawUrl, 'http://localhost').pathname

            if (pathname === '/api/follows/status') {
                return Promise.resolve(new Response(JSON.stringify({ isFollowing: false }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }))
            }

            if (pathname === '/api/follows/count') {
                return Promise.resolve(new Response(JSON.stringify({ count: 0 }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }))
            }

            if (pathname === '/api/follows') {
                return Promise.resolve(new Response(JSON.stringify({
                    ok: true,
                    following: true,
                    changed: false,
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }))
            }

            throw new Error(`Unexpected fetch: ${rawUrl}`)
        }))
    })

    it('does not create a follow notification when the follow already exists', async () => {
        const { result } = renderHook(() => useFollow('22222222-2222-2222-2222-222222222222'), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        await act(async () => {
            result.current.follow()
        })

        await waitFor(() => {
            expect(mockCreateNotification).not.toHaveBeenCalled()
        })
    })
})
