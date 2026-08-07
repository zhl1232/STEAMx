import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ShopPage, { getShopMutationErrorMessage } from './page'

const mockUseQuery = vi.fn()
const mockUseMutation = vi.fn()
const mockInvalidateQueries = vi.fn()
const mockRefetchInventory = vi.fn()
const mockToast = vi.fn()

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
  }),
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: '11111111-1111-1111-1111-111111111111', user_metadata: {} },
    profile: {
      display_name: '测试用户',
      equipped_avatar_frame_id: null,
      equipped_name_color_id: null,
    },
    loading: false,
    refreshProfile: vi.fn(),
  }),
}))

vi.mock('@/lib/context/gamification-context', () => ({
  useGamification: () => ({
    coins: 100,
    level: 1,
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn(),
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}))

describe('ShopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchInventory,
    })
  })

  it('shows a retry state when inventory loading fails', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('inventory unavailable'),
      refetch: mockRefetchInventory,
    })

    render(<ShopPage />)

    expect(screen.getByText('加载商店失败')).toBeInTheDocument()
    expect(screen.getByText('inventory unavailable')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '刷新重试' }))
    expect(mockRefetchInventory).toHaveBeenCalledTimes(1)
  })

  it('uses the top profile card as the item preview', () => {
    render(<ShopPage />)

    expect(screen.getByRole('heading', { name: '商店', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '返回上一页' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '手机实时预览' })).not.toBeInTheDocument()
    const topPreview = screen.getByRole('region', { name: '商店个人预览' })
    expect(within(topPreview).getByText('测试用户')).toBeInTheDocument()
    expect(topPreview.querySelector('.avatar-frame-pixel-border')).toBeInTheDocument()

    const lockedItemCard = screen.getByText('深海琉璃').closest('article')
    expect(lockedItemCard).not.toBeNull()
    fireEvent.click(lockedItemCard!)

    expect(topPreview.querySelector('.avatar-frame-crystal-glass')).toBeInTheDocument()
    expect(within(topPreview).queryByText('Lv.5 解锁')).not.toBeInTheDocument()
  })

  it('previews name color items in the top profile card', async () => {
    const user = userEvent.setup()
    render(<ShopPage />)

    await user.click(screen.getByRole('tab', { name: /昵称颜色/ }))

    await waitFor(() => {
      const topPreview = screen.getByRole('region', { name: '商店个人预览' })
      expect(within(topPreview).getByText('测试用户')).toHaveClass('name-color-cherry')
      expect(within(topPreview).queryByText('昵称效果')).not.toBeInTheDocument()
    })
  })

  it('keeps the shop focused on browsing and purchasing', () => {
    render(<ShopPage />)

    expect(screen.queryByText('用实践获得的硬币兑换个性化装扮')).not.toBeInTheDocument()
    expect(screen.queryByText('展示在个人主页与排行榜头像周围')).not.toBeInTheDocument()
    expect(screen.queryByText('效果预览')).not.toBeInTheDocument()
    expect(screen.queryByText('排行榜预览')).not.toBeInTheDocument()
    expect(screen.queryByText('更多装扮持续上线中')).not.toBeInTheDocument()
  })

  it('maps min level purchase errors to a readable message', () => {
    expect(
      getShopMutationErrorMessage({
        code: 'min_level_required',
        minLevel: 20,
        message: 'min_level_required',
      }),
    ).toBe('等级不足，需达到 Lv.20')
  })
})
