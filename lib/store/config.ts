/** Physical-goods rollout only; the virtual coin shop is unaffected. */

export function isStorePreviewEnabled(): boolean {
  let localDatabase = false
  try {
    localDatabase = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname)
  } catch { /* Missing configuration must fail closed. */ }
  return process.env.NODE_ENV !== 'production'
    && process.env.STORE_ENVIRONMENT === 'test'
    && process.env.STORE_ADMIN_PREVIEW_ENABLED === 'true'
    && localDatabase
}

export function isStoreCatalogVisible(): boolean {
  return process.env.STORE_CATALOG_ENABLED === 'true'
}

export function isStorePaymentEnabled(provider?: 'alipay' | 'wechat'): boolean {
  return process.env.STORE_PAYMENTS_ENABLED === 'true'
    && (!provider || process.env[`STORE_${provider.toUpperCase()}_ENABLED`] === 'true')
}

export function isStoreCheckoutEnabled(): boolean {
  return isStoreCatalogVisible() && process.env.STORE_CHECKOUT_ENABLED === 'true'
}
