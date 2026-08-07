import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MessagesPage from './page'

const mockReplace = vi.fn()
const mockPush = vi.fn()
let mockTab: string | null = 'invalid-tab'
let mockConversationsError: string | null = null
let mockConversations: Array<{
    peerId: string
    displayName: string | null
    avatarUrl: string | null
    lastContent: string
    lastAt: string
    unreadCount: number
}> = []
let mockDmUnreadCount = 0
let mockNotificationUnreadCount = 0
const mockMarkAllAsRead = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: mockReplace,
        push: mockPush,
    }),
    useSearchParams: () => ({
        get: (key: string) => (key === 'tab' ? mockTab : null),
    }),
}))

vi.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}))

vi.mock('@/lib/context/auth-context', () => ({
    useAuth: () => ({
        user: { id: '11111111-1111-1111-1111-111111111111' },
        loading: false,
    }),
}))

vi.mock('@/lib/context/notification-context', () => ({
    useNotifications: () => ({
        notifications: [],
        unreadCount: mockDmUnreadCount,
        notificationUnreadCount: mockNotificationUnreadCount,
        dmUnreadCount: mockDmUnreadCount,
        markAsRead: vi.fn(),
        markAllAsRead: mockMarkAllAsRead,
        loadMore: vi.fn(),
        hasMore: false,
        isLoadingMore: false,
        isLoading: false,
    }),
}))

vi.mock('@/hooks/use-messages', () => ({
    useConversations: () => ({
        conversations: mockConversations,
        dmUnreadCount: mockDmUnreadCount,
        isLoading: false,
        error: mockConversationsError,
    }),
}))

vi.mock('@/components/features/social/follow-button', () => ({
    FollowButton: () => null,
}))

describe('MessagesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockTab = 'invalid-tab'
        mockConversationsError = null
        mockConversations = []
        mockDmUnreadCount = 0
        mockNotificationUnreadCount = 0
    })

    it('falls back to the replies tab when the tab query parameter is invalid', async () => {
        render(<MessagesPage />)

        expect(await screen.findByText('还没有新的回复或提及')).toBeInTheDocument()
        expect(screen.queryByText('还没有新的喜欢')).not.toBeInTheDocument()
        expect(screen.queryByText('还没有新的粉丝提醒')).not.toBeInTheDocument()
        expect(screen.queryByText('暂无私信')).not.toBeInTheDocument()
    })

    it('shows a load failure state on the dm tab when conversations fail to load', async () => {
        mockTab = 'dm'
        mockConversationsError = '服务暂时不可用'

        render(<MessagesPage />)

        expect(await screen.findByText('私信加载失败')).toBeInTheDocument()
        expect(screen.getByText('服务暂时不可用')).toBeInTheDocument()
        expect(screen.queryByText('暂无私信')).not.toBeInTheDocument()
    })

    it('shows unread badges on the dm tab and conversation list', async () => {
        mockTab = 'dm'
        mockDmUnreadCount = 2
        mockConversations = [
            {
                peerId: '22222222-2222-2222-2222-222222222222',
                displayName: 'Alice',
                avatarUrl: null,
                lastContent: '新的私信',
                lastAt: '2026-06-04T06:00:00.000Z',
                unreadCount: 2,
            },
        ]

        render(<MessagesPage />)

        expect(await screen.findByText('Alice')).toBeInTheDocument()
        expect(screen.getByText('新的私信')).toHaveClass('font-medium')
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('uses a compact clear action in the mobile header for notification tabs', async () => {
        mockNotificationUnreadCount = 1

        const { container } = render(<MessagesPage />)

        expect(await screen.findByText('还没有新的回复或提及')).toBeInTheDocument()
        expect(container.querySelector('button[aria-label="全部标为已读"][title="全部标为已读"]')).not.toBeNull()
        expect(screen.queryByText('查看提及、回复与创作者动态')).not.toBeInTheDocument()
    })

    it('does not show the notification clear action on the dm tab', async () => {
        mockTab = 'dm'
        mockNotificationUnreadCount = 1

        render(<MessagesPage />)

        expect(await screen.findByText('还没有私信对话')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '全部标为已读' })).not.toBeInTheDocument()
    })
})
