import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStoreCatalogVisible, isStoreCheckoutEnabled, isStorePaymentEnabled, isStorePreviewEnabled } from './config'

afterEach(() => vi.unstubAllEnvs())

describe('physical store rollout gates', () => {
  it('keeps catalog, checkout and provider payment independently disabled', () => {
    for (const name of ['STORE_CATALOG_ENABLED', 'STORE_CHECKOUT_ENABLED', 'STORE_PAYMENTS_ENABLED', 'STORE_ALIPAY_ENABLED']) vi.stubEnv(name, '')
    expect(isStoreCatalogVisible()).toBe(false)
    expect(isStoreCheckoutEnabled()).toBe(false)
    expect(isStorePaymentEnabled('alipay')).toBe(false)
    vi.stubEnv('STORE_CATALOG_ENABLED', 'true')
    expect(isStoreCheckoutEnabled()).toBe(false)
    vi.stubEnv('STORE_PAYMENTS_ENABLED', 'true')
    expect(isStorePaymentEnabled('alipay')).toBe(false)
  })

  it('never permits admin preview in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STORE_ENVIRONMENT', 'test')
    vi.stubEnv('STORE_ADMIN_PREVIEW_ENABLED', 'true')
    expect(isStorePreviewEnabled()).toBe(false)
  })

  it('requires explicit isolated test configuration for preview', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('STORE_ADMIN_PREVIEW_ENABLED', 'true')
    vi.stubEnv('STORE_ENVIRONMENT', 'live')
    expect(isStorePreviewEnabled()).toBe(false)
    vi.stubEnv('STORE_ENVIRONMENT', 'test')
    expect(isStorePreviewEnabled()).toBe(true)
  })
})
