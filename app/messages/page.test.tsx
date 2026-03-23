import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MessagesPage from './page'

const mockReplace = vi.fn()
const mockPush = vi.fn()
let mockTab: string | null = 'invalid-tab'
let mockConversationsError: string | null = null

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

vi.mock('@/context/auth-context', () => ({
    useAuth: () => ({
        user: { id: '11111111-1111-1111-1111-111111111111' },
        loading: false,
    }),
}))

vi.mock('@/context/notification-context', () => ({
    useNotifications: () => ({
        notifications: [],
        unreadCount: 0,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        loadMore: vi.fn(),
        hasMore: false,
        isLoadingMore: false,
        isLoading: false,
    }),
}))

vi.mock('@/hooks/use-messages', () => ({
    useConversations: () => ({
        conversations: [],
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
    })

    it('falls back to the replies tab when the tab query parameter is invalid', async () => {
        render(<MessagesPage />)

        expect(await screen.findByText('暂无回复与@提及')).toBeInTheDocument()
        expect(screen.queryByText('暂无收到喜欢')).not.toBeInTheDocument()
        expect(screen.queryByText('暂无新增粉丝')).not.toBeInTheDocument()
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
})
