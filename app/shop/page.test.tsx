import { fireEvent, render, screen } from '@testing-library/react'
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
