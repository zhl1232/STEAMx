import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBlock } from './use-block'

const targetUserId = '22222222-2222-2222-2222-222222222222'

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useBlock', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const rawUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
      const pathname = new URL(rawUrl, 'http://localhost').pathname

      if (pathname === '/api/blocks' && !init?.method) {
        return Promise.resolve(new Response(JSON.stringify({
          blocked: false,
          blockedByMe: false,
          userId: targetUserId,
        }), { status: 200 }))
      }

      if (pathname === '/api/blocks' && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ blocked: true, userId: targetUserId }), { status: 200 }))
      }

      if (pathname === `/api/blocks/${targetUserId}` && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ blocked: false, userId: targetUserId }), { status: 200 }))
      }

      throw new Error(`Unexpected fetch: ${rawUrl}`)
    }))
  })

  it('keeps ownership of the block state so it can be cancelled', async () => {
    const { result } = renderHook(() => useBlock(targetUserId), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      result.current.toggleBlock()
    })

    await waitFor(() => {
      expect(result.current.blocked).toBe(true)
      expect(result.current.blockedByMe).toBe(true)
    })

    await act(async () => {
      result.current.toggleBlock()
    })

    await waitFor(() => {
      expect(result.current.blocked).toBe(false)
      expect(result.current.blockedByMe).toBe(false)
    })
  })
})
