import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConversationPage from './page'
import type { Message } from '@/lib/mappers/types'

let mockUserId = '22222222-2222-2222-2222-222222222222'
const mockReplace = vi.fn()
const mockLoadMore = vi.fn()
const mockSendMessage = vi.fn()
let mockConversationError: string | null = null
let mockConversationMessages: Message[] = []
let mockConversationPeer: { id: string; display_name: string | null; avatar_url: string | null } | null = null
let mockBlocked = false
let mockBlockedByMe = false

vi.mock('next/navigation', () => ({
    useParams: () => ({ userId: mockUserId }),
    useRouter: () => ({ replace: mockReplace }),
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
        profile: { age_confirmed_at: null },
        loading: false,
    }),
}))

vi.mock('@/hooks/use-messages', () => ({
    useConversationMessages: () => ({
        messages: mockConversationMessages,
        peer: mockConversationPeer,
        isLoading: false,
        hasMore: false,
        isLoadingMore: false,
        loadMore: mockLoadMore,
        error: mockConversationError,
    }),
    useSendMessage: () => ({
        sendMessage: mockSendMessage,
        isPending: false,
    }),
    useMarkConversationRead: () => ({
        markConversationRead: vi.fn(() => Promise.resolve()),
        isPending: false,
    }),
}))

vi.mock('@/hooks/use-block', () => ({
    useBlock: () => ({
        blocked: mockBlocked,
        blockedByMe: mockBlockedByMe,
        isLoading: false,
        isPending: false,
        toggleBlock: vi.fn(),
    }),
}))

vi.mock('@/components/ui/report-dialog', () => ({
    ReportDialog: () => null,
}))

describe('ConversationPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUserId = '22222222-2222-2222-2222-222222222222'
        mockConversationError = null
        mockConversationMessages = []
        mockConversationPeer = null
        mockBlocked = false
        mockBlockedByMe = false
    })

    it('shows a missing-user state instead of the empty-thread message', () => {
        render(<ConversationPage />)

        expect(screen.getAllByText('用户不存在').length).toBeGreaterThan(0)
        expect(screen.getByText('该用户暂时不可用')).toBeInTheDocument()
        expect(screen.getByText('该用户不存在，或当前无法向对方发起会话。')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('当前无法向该用户发送消息')).toBeDisabled()
        expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
        expect(screen.queryByText('还没有消息')).not.toBeInTheDocument()
        expect(screen.queryByText('发送私信前请先完成社区互动确认，点击发送即可弹出确认窗口。')).not.toBeInTheDocument()
    })

    it('keeps the mobile conversation header anchored to the viewport top', () => {
        render(<ConversationPage />)

        const backButton = screen.getByRole('button', { name: '返回上一页' })
        const headerBar = backButton.parentElement
        const header = backButton.parentElement?.parentElement

        expect(headerBar).toHaveClass('pl-px')
        expect(header).toHaveClass('fixed', 'top-0')
        expect(header).not.toHaveClass('-mt-6', '-mx-4')
    })

    it('links the conversation header to the peer public profile without a block action', () => {
        mockConversationPeer = { id: mockUserId, display_name: '对方', avatar_url: null }

        render(<ConversationPage />)

        const profileLinks = screen.getAllByRole('link', { name: '查看对方的公开主页' })
        expect(profileLinks.length).toBeGreaterThan(0)
        expect(profileLinks[0]).toHaveAttribute('href', `/users/${mockUserId}`)
        expect(screen.queryByRole('button', { name: /屏蔽|取消屏蔽/ })).not.toBeInTheDocument()
    })

    it('shows an invalid-thread state for malformed user ids', () => {
        mockUserId = 'not-a-uuid'

        render(<ConversationPage />)

        expect(screen.getAllByText('无效会话').length).toBeGreaterThan(0)
        expect(screen.getByText('私信地址无效')).toBeInTheDocument()
        expect(screen.getByText('请返回消息列表重新进入会话。')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('无效会话地址，无法发送消息')).toBeDisabled()
        expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
    })

    it('shows a load failure state instead of treating server errors as a missing user', () => {
        mockConversationError = '会话加载失败，请稍后重试'

        render(<ConversationPage />)

        expect(screen.getAllByText('加载失败').length).toBeGreaterThan(0)
        expect(screen.getByText('会话加载失败')).toBeInTheDocument()
        expect(screen.getByText('会话加载失败，请稍后重试')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('会话加载失败，暂时无法发送消息')).toBeDisabled()
        expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
        expect(screen.queryByText('该用户不存在或暂时无法发起会话')).not.toBeInTheDocument()
    })

    it('groups nearby messages under one separator instead of repeating time in every bubble', () => {
        const now = Date.now()
        const currentUserId = '11111111-1111-1111-1111-111111111111'
        const otherUserId = '22222222-2222-2222-2222-222222222222'
        const messageAt = (id: number, senderId: string, content: string, minutesAgo: number): Message => ({
            id,
            sender_id: senderId,
            receiver_id: senderId === currentUserId ? otherUserId : currentUserId,
            content,
            read_at: null,
            created_at: new Date(now - minutesAgo * 60_000).toISOString(),
        })

        mockConversationPeer = { id: otherUserId, display_name: '对方', avatar_url: null }
        mockConversationMessages = [
            messageAt(1, otherUserId, '第一条', 20 * 60),
            messageAt(2, otherUserId, '第二条', 19 * 60),
            messageAt(3, currentUserId, '第三条', 10 * 60),
            messageAt(4, currentUserId, '第四条', 9 * 60),
        ]

        const { container } = render(<ConversationPage />)

        expect(container.querySelectorAll('time.message-time')).toHaveLength(2)
        expect(screen.getByText('第一条').parentElement?.querySelector('time')).toBeNull()
        expect(screen.getByText('第二条').parentElement?.querySelector('time')).toBeNull()
        expect(screen.getByText('第三条').parentElement?.querySelector('time')).toBeNull()
        expect(screen.getByText('第四条').parentElement?.querySelector('time')).toBeNull()
    })

    it('explains which side blocked the conversation', () => {
        mockConversationPeer = { id: mockUserId, display_name: '对方', avatar_url: null }
        mockBlocked = true
        mockBlockedByMe = true

        render(<ConversationPage />)

        expect(screen.getByText('你已屏蔽对方，无法发送私信。')).toBeInTheDocument()
    })

    it('lets mobile users select incoming messages before reporting them', () => {
        const currentUserId = '11111111-1111-1111-1111-111111111111'
        const otherUserId = mockUserId
        const message = (id: number, senderId: string, content: string): Message => ({
            id,
            sender_id: senderId,
            receiver_id: senderId === currentUserId ? otherUserId : currentUserId,
            content,
            read_at: null,
            created_at: new Date().toISOString(),
        })

        mockConversationPeer = { id: otherUserId, display_name: '对方', avatar_url: null }
        mockConversationMessages = [
            message(1, otherUserId, '请查看这个链接'),
            message(2, currentUserId, '好的'),
            message(3, otherUserId, '这条也需要处理'),
        ]

        render(<ConversationPage />)

        fireEvent.click(screen.getByRole('button', { name: '举报消息' }))

        expect(screen.getByRole('button', { name: '退出举报选择' })).toBeInTheDocument()
        expect(screen.getByText('请选择要举报的对方消息，最多 10 条')).toBeInTheDocument()
        expect(screen.getAllByRole('checkbox')).toHaveLength(2)
        const firstCheckbox = screen.getByRole('checkbox', { name: '选择消息：请查看这个链接' })
        expect(firstCheckbox).toHaveClass('h-5', 'w-5')
        expect(firstCheckbox.parentElement).toHaveClass('h-11', 'w-11')
        expect(screen.queryByRole('checkbox', { name: '选择消息：好的' })).not.toBeInTheDocument()

        const submitButton = screen.getByRole('button', { name: '举报选中消息（0）' })
        expect(submitButton).toBeDisabled()

        fireEvent.click(screen.getByRole('checkbox', { name: '选择消息：请查看这个链接' }))
        fireEvent.click(screen.getByRole('checkbox', { name: '选择消息：这条也需要处理' }))

        expect(screen.getByRole('button', { name: '举报选中消息（2）' })).toBeEnabled()
    })
})
