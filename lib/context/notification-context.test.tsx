import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    __resetNotificationUnreadCountCacheForTests,
    NotificationProvider,
    mergeLatestNotificationState,
    mergeLatestNotifications,
    useNotifications,
} from './notification-context'

const mockSupabaseChannel = vi.fn()
const mockRemoveChannel = vi.fn()
const mockRealtimeDisconnect = vi.fn()
let mockChannel: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> }

const mockAuthState = {
    user: { id: 'user-1' },
}

vi.mock('@/lib/context/auth-context', () => ({
    useAuth: () => mockAuthState,
}))

vi.mock('next/navigation', () => ({
    usePathname: () => '/messages',
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
    },
}))

vi.mock('@/lib/supabase/client', () => {
    return {
        createClient: () => ({
            channel: mockSupabaseChannel.mockReturnValue(mockChannel),
            removeChannel: mockRemoveChannel,
            realtime: {
                disconnect: mockRealtimeDisconnect,
            },
        }),
    }
})

function jsonResponse(body: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

function TestComponent() {
    const { unreadCount, notificationUnreadCount, dmUnreadCount, isLoading, markAsRead, notifications, hasMore, loadCategory, loadMore } = useNotifications()

    if (isLoading) {
        return <div>loading</div>
    }

    return (
        <div>
            <div data-testid="unread-count">{unreadCount}</div>
            <div data-testid="notification-unread-count">{notificationUnreadCount}</div>
            <div data-testid="dm-unread-count">{dmUnreadCount}</div>
            <div data-testid="has-more">{String(hasMore)}</div>
            <div data-testid="notification-list">{notifications.map((notification) => notification.content).join('|')}</div>
            <button type="button" onClick={() => void markAsRead(1)}>
                mark-read
            </button>
            <button type="button" onClick={() => void loadCategory('replies')}>replies</button>
            <button type="button" onClick={() => void loadCategory('likes')}>likes</button>
            <button type="button" onClick={() => void loadMore()}>load-more</button>
        </div>
    )
}

describe('NotificationProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useRealTimers()
        mockChannel = {
            on: vi.fn(() => mockChannel),
            subscribe: vi.fn(() => mockChannel),
        }
        delete process.env.NEXT_PUBLIC_ENABLE_NOTIFICATION_REALTIME
        __resetNotificationUnreadCountCacheForTests()
        window.history.replaceState({}, '', '/messages')
        vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
            const rawUrl = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url
            const pathname = new URL(rawUrl, 'http://localhost').pathname

            if (pathname === '/api/notifications') {
                return Promise.resolve(jsonResponse({
                    notifications: [
                        {
                            id: 1,
                            user_id: 'user-1',
                            type: 'reply',
                            content: '已读通知',
                            is_read: true,
                            created_at: '2026-03-20T00:00:00.000Z',
                        },
                        {
                            id: 2,
                            user_id: 'user-1',
                            type: 'reply',
                            content: '未读通知',
                            is_read: false,
                            created_at: '2026-03-20T00:01:00.000Z',
                        },
                    ],
                    hasMore: false,
                }))
            }

            if (pathname === '/api/notifications/unread-count') {
                return Promise.resolve(jsonResponse({ count: 1 }))
            }

            if (pathname === '/api/messages/unread-count') {
                return Promise.resolve(jsonResponse({ count: 2 }))
            }

            if (pathname === '/api/notifications/mark-read') {
                return Promise.resolve(jsonResponse({ ok: true, changed: false }))
            }

            throw new Error(`Unexpected fetch: ${rawUrl}`)
        }))
    })

    it('subscribes to unread counts through a private Realtime channel', async () => {
        process.env.NEXT_PUBLIC_ENABLE_NOTIFICATION_REALTIME = 'true'

        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>,
        )

        await waitFor(() => {
            expect(mockSupabaseChannel).toHaveBeenCalledWith('unread-counts:user-1', {
                config: { private: true },
            })
        })
    })

    it('skips the realtime websocket when disabled while keeping HTTP unread counts', async () => {
        process.env.NEXT_PUBLIC_ENABLE_NOTIFICATION_REALTIME = 'false'

        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('unread-count')).toHaveTextContent('3')
        })
        expect(mockSupabaseChannel).not.toHaveBeenCalled()
    })

    it('disconnects realtime after a channel failure while keeping HTTP unread counts', async () => {
        process.env.NEXT_PUBLIC_ENABLE_NOTIFICATION_REALTIME = 'true'
        mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
            callback('CHANNEL_ERROR')
            return mockChannel
        })
        mockRemoveChannel.mockResolvedValue('ok')

        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('unread-count')).toHaveTextContent('3')
        })
        expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
        await waitFor(() => {
            expect(mockRealtimeDisconnect).toHaveBeenCalled()
        })
    })

    it('deduplicates concurrent unread-count refreshes across provider mounts', async () => {
        render(
            <>
                <NotificationProvider>
                    <TestComponent />
                </NotificationProvider>
                <NotificationProvider>
                    <TestComponent />
                </NotificationProvider>
            </>,
        )

        await waitFor(() => {
            expect(screen.getAllByTestId('unread-count')[0]).toHaveTextContent('3')
        })

        const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
            .map(([input]) => {
                const rawUrl = typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.toString()
                        : input.url
                return new URL(rawUrl, 'http://localhost').pathname
            })

        expect(calls.filter((pathname) => pathname === '/api/notifications/unread-count')).toHaveLength(1)
        expect(calls.filter((pathname) => pathname === '/api/messages/unread-count')).toHaveLength(1)
    })

    it('does not decrement unread count when marking an already-read local notification', async () => {
        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('unread-count')).toHaveTextContent('3')
            expect(screen.getByTestId('notification-unread-count')).toHaveTextContent('1')
            expect(screen.getByTestId('dm-unread-count')).toHaveTextContent('2')
        })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'mark-read' }))
        })

        expect(screen.getByTestId('unread-count')).toHaveTextContent('3')
        expect(screen.getByTestId('notification-unread-count')).toHaveTextContent('1')
        expect(screen.getByTestId('dm-unread-count')).toHaveTextContent('2')
    })

    it('keeps older notifications while prepending refreshed first-page items', () => {
        const merged = mergeLatestNotifications(
            [
                {
                    id: 2,
                    user_id: 'user-1',
                    type: 'reply',
                    content: '轮询新通知',
                    is_read: false,
                    created_at: '2026-03-20T00:01:00.000Z',
                },
            ],
            [
                {
                    id: 1,
                    user_id: 'user-1',
                    type: 'reply',
                    content: '初始通知',
                    is_read: false,
                    created_at: '2026-03-20T00:00:00.000Z',
                },
            ],
        )

        expect(merged.map((notification) => notification.content)).toEqual(['轮询新通知', '初始通知'])
    })

    it('keeps hasMore closed while prepending refreshed first-page items', () => {
        const merged = mergeLatestNotificationState(
            [
                {
                    id: 2,
                    user_id: 'user-1',
                    type: 'reply',
                    content: '轮询新通知',
                    is_read: false,
                    created_at: '2026-03-20T00:01:00.000Z',
                },
            ],
            [
                {
                    id: 1,
                    user_id: 'user-1',
                    type: 'reply',
                    content: '初始通知',
                    is_read: false,
                    created_at: '2026-03-20T00:00:00.000Z',
                },
            ],
            false,
        )

        expect(merged.notifications.map((notification) => notification.content)).toEqual(['轮询新通知', '初始通知'])
        expect(merged.hasMore).toBe(false)
    })

    it('does not let an older category response overwrite the latest category', async () => {
        let resolveReplies!: (response: Response) => void
        let resolveLikes!: (response: Response) => void
        const replies = new Promise<Response>((resolve) => { resolveReplies = resolve })
        const likes = new Promise<Response>((resolve) => { resolveLikes = resolve })
        vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
            const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
            const url = new URL(rawUrl, 'http://localhost')
            if (url.pathname === '/api/notifications' && url.searchParams.get('category') === 'replies') return replies
            if (url.pathname === '/api/notifications' && url.searchParams.get('category') === 'likes') return likes
            if (url.pathname === '/api/notifications/unread-count') return Promise.resolve(jsonResponse({ count: 0 }))
            if (url.pathname === '/api/messages/unread-count') return Promise.resolve(jsonResponse({ count: 0 }))
            if (url.pathname === '/api/notifications') return Promise.resolve(jsonResponse({ notifications: [], hasMore: false }))
            throw new Error(`Unexpected fetch: ${rawUrl}`)
        }))

        render(<NotificationProvider><TestComponent /></NotificationProvider>)
        await waitFor(() => expect(screen.getByRole('button', { name: 'replies' })).toBeVisible())
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'replies' }))
            fireEvent.click(screen.getByRole('button', { name: 'likes' }))
        })
        resolveLikes(jsonResponse({ notifications: [{ id: 2, user_id: 'user-1', type: 'like', content: 'likes result', is_read: false, created_at: '2026-03-20T00:00:00.000Z' }], hasMore: false }))
        await waitFor(() => expect(screen.getByTestId('notification-list')).toHaveTextContent('likes result'))
        resolveReplies(jsonResponse({ notifications: [{ id: 1, user_id: 'user-1', type: 'reply', content: 'stale replies result', is_read: false, created_at: '2026-03-20T00:00:00.000Z' }], hasMore: false }))
        await act(async () => { await replies })
        expect(screen.getByTestId('notification-list')).toHaveTextContent('likes result')
        expect(screen.getByTestId('notification-list')).not.toHaveTextContent('stale replies result')
    })

    it('loads a same-timestamp next page with both before and beforeId', async () => {
        let page = 0
        let requestedUrl = ''
        vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
            const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
            const url = new URL(rawUrl, 'http://localhost')
            if (url.pathname === '/api/notifications/unread-count') return Promise.resolve(jsonResponse({ count: 0 }))
            if (url.pathname === '/api/messages/unread-count') return Promise.resolve(jsonResponse({ count: 0 }))
            if (url.pathname === '/api/notifications') {
                requestedUrl = url.toString()
                page += 1
                return Promise.resolve(jsonResponse(page === 1
                    ? { notifications: [{ id: 2, user_id: 'user-1', type: 'reply', content: 'first', is_read: false, created_at: '2026-03-20T00:00:00.000Z' }], hasMore: true }
                    : { notifications: [{ id: 1, user_id: 'user-1', type: 'reply', content: 'same timestamp older id', is_read: false, created_at: '2026-03-20T00:00:00.000Z' }], hasMore: false }))
            }
            throw new Error(`Unexpected fetch: ${rawUrl}`)
        }))

        render(<NotificationProvider><TestComponent /></NotificationProvider>)
        await waitFor(() => expect(screen.getByTestId('notification-list')).toHaveTextContent('first'))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'load-more' })) })
        await waitFor(() => expect(screen.getByTestId('notification-list')).toHaveTextContent('same timestamp older id'))
        const query = new URL(requestedUrl).searchParams
        expect(query.get('before')).toBe('2026-03-20T00:00:00.000Z')
        expect(query.get('beforeId')).toBe('2')
    })
})
