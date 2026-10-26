import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { StoreAvailabilityProvider, useStoreCatalogVisible } from './store-availability-context'
import { MainNav } from '@/components/layout/main-nav'
import { ProfileServices } from '@/components/profile/profile-services'

vi.mock('next/navigation', () => ({ usePathname: () => '/store' }))
afterEach(() => vi.unstubAllGlobals())

function AvailabilityConsumer() {
  const catalogVisible = useStoreCatalogVisible()
  return <output aria-label="目录可用性">{String(catalogVisible)}</output>
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><StoreAvailabilityProvider><MainNav /><ProfileServices /><AvailabilityConsumer /></StoreAvailabilityProvider></QueryClientProvider>)
  return client
}

it('updates availability from the runtime response while keeping catalog menu links hidden', async () => {
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
  const client = mount()
  expect(screen.queryByRole('link', { name: '实物商城' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('目录可用性')).toHaveTextContent('false')
  finish(Response.json({ catalogVisible: true }))
  await waitFor(() => expect(screen.getByLabelText('目录可用性')).toHaveTextContent('true'))
  expect(screen.queryByRole('link', { name: '实物商城' })).not.toBeInTheDocument()
  const services = within(screen.getByRole('region', { name: '购物与服务' }))
  expect(services.getByRole('link', { name: '我的订单' })).toHaveAttribute('href', '/store/orders')
  expect(services.getByRole('link', { name: '平台帮助' })).toHaveAttribute('href', '/support')
  expect(services.getByRole('link', { name: '商城客服' })).toHaveAttribute('href', '/store/support')
  expect(fetch).toHaveBeenCalledOnce()
  client.clear()
})

it.each([false, 'unavailable'])('keeps order and support links when the catalog is %s', async (state) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(state === false ? Response.json({ catalogVisible: false }) : new Response('', { status: 503 })))
  const client = mount()
  await waitFor(() => expect(client.getQueryState(['store-availability'])?.fetchStatus).toBe('idle'))
  expect(screen.getByLabelText('目录可用性')).toHaveTextContent('false')
  expect(screen.queryByRole('link', { name: '实物商城' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '我的订单' })).toHaveAttribute('href', '/store/orders')
  expect(screen.getByRole('link', { name: '平台帮助' })).toHaveAttribute('href', '/support')
  expect(screen.getByRole('link', { name: '商城客服' })).toHaveAttribute('href', '/store/support')
  client.clear()
})
