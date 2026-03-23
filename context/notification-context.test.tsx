import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationProvider, mergeLatestNotificationState, mergeLatestNotifications, useNotifications } from './notification-context'

const mockAuthState = {
    user: { id: 'user-1' },
}

vi.mock('@/context/auth-context', () => ({
    useAuth: () => mockAuthState,
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}))

function jsonResponse(body: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

function TestComponent() {
    const { unreadCount, isLoading, markAsRead, notifications, hasMore } = useNotifications()

    if (isLoading) {
        return <div>loading</div>
    }

    return (
        <div>
            <div data-testid="unread-count">{unreadCount}</div>
            <div data-testid="has-more">{String(hasMore)}</div>
            <div data-testid="notification-list">{notifications.map((notification) => notification.content).join('|')}</div>
            <button type="button" onClick={() => void markAsRead(1)}>
                mark-read
            </button>
        </div>
    )
}

describe('NotificationProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useRealTimers()
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

            if (pathname === '/api/notifications/mark-read') {
                return Promise.resolve(jsonResponse({ ok: true, changed: false }))
            }

            throw new Error(`Unexpected fetch: ${rawUrl}`)
        }))
    })

    it('does not decrement unread count when marking an already-read local notification', async () => {
        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('unread-count')).toHaveTextContent('1')
        })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'mark-read' }))
        })

        expect(screen.getByTestId('unread-count')).toHaveTextContent('1')
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
})
