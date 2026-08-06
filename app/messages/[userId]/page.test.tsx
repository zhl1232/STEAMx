import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConversationPage from './page'

let mockUserId = '22222222-2222-2222-2222-222222222222'
const mockReplace = vi.fn()
const mockLoadMore = vi.fn()
const mockSendMessage = vi.fn()
let mockConversationError: string | null = null

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
        messages: [],
        peer: null,
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
        markConversationRead: vi.fn(),
        isPending: false,
    }),
}))

vi.mock('@/hooks/use-block', () => ({
    useBlock: () => ({
        blocked: false,
        blockedByMe: false,
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
        const header = backButton.parentElement?.parentElement

        expect(header).toHaveClass('fixed', 'top-0')
        expect(header).not.toHaveClass('-mt-6')
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
})
