import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ObservationEvent } from '@/lib/mappers/types'

vi.mock('@/components/features/bird-observation/observation-card', () => ({
  ObservationCard: ({ observation }: { observation: ObservationEvent }) => <div>观察 {observation.id}</div>,
}))

import { ObservationsListLoadMore } from './observations-list-load-more'

const observation = { id: 1 } as ObservationEvent

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ObservationsListLoadMore pagination links', () => {
  it('renders ordinary SSR prev/next anchors for a later page', () => {
    const html = renderToString(
      <ObservationsListLoadMore
        initialObservations={[observation]}
        initialPage={1}
        pageSize={12}
        initialHasMore
        total={25}
      />,
    )

    expect(html).toContain('href="/nature/observations"')
    expect(html).toContain('href="/nature/observations?page=2"')
    expect(html).not.toContain('noscript')
  })

  it('updates the next anchor and loaded results after fetching another page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ observations: [{ id: 2 }], hasMore: true }),
    }))

    render(
      <ObservationsListLoadMore
        initialObservations={[observation]}
        initialPage={0}
        pageSize={12}
        initialHasMore
        total={25}
      />,
    )

    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute('href', '/nature/observations?page=1')
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))

    await waitFor(() => expect(screen.getByText('观察 2')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute('href', '/nature/observations?page=2')
    expect(fetch).toHaveBeenCalledWith('/api/observations?page=1&pageSize=12')
  })
})
