import { afterEach, expect, it, vi } from 'vitest'
import StoreLayout, { generateMetadata } from './layout'
import StoreOrdersLayout, { metadata as ordersMetadata } from './orders/layout'
import { requirePageUser } from '@/lib/auth/server'

vi.mock('@/lib/auth/server', () => ({ requirePageUser: vi.fn() }))
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks() })

it.each(['false', 'true'])('keeps order titles and authentication independent of catalog=%s', async (enabled) => {
  vi.stubEnv('STORE_CATALOG_ENABLED', enabled)
  expect(generateMetadata()).toMatchObject({
    title: { absolute: `${enabled === 'true' ? '材料包商城' : '页面未找到'} | 创探空间` },
    robots: { index: false, follow: false },
  })
  expect(ordersMetadata.title).toMatchObject({ absolute: '本站材料包订单 | 创探空间' })
  expect(StoreLayout({ children: 'orders' })).toBe('orders')
  vi.mocked(requirePageUser).mockRejectedValueOnce(new Error('login required'))
  await expect(StoreOrdersLayout({ children: 'private order' })).rejects.toThrow('login required')
  vi.mocked(requirePageUser).mockResolvedValueOnce({} as Awaited<ReturnType<typeof requirePageUser>>)
  expect(await StoreOrdersLayout({ children: 'private order' })).toBe('private order')
  expect(requirePageUser).toHaveBeenCalledTimes(2)
})
