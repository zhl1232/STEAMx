import { notFound } from 'next/navigation'
import { requirePageUser } from '@/lib/auth/server'
import { buildLoginRedirect } from '@/lib/auth/login-redirect'
import { isStoreCatalogVisible } from '@/lib/store/config'
import { StoreCheckout } from '@/components/store/store-checkout'
export const dynamic = 'force-dynamic'
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isStoreCatalogVisible()) notFound()
  const params = await searchParams
  const productId = typeof params.product === 'string' ? params.product : ''
  const variantId = typeof params.variant === 'string' ? params.variant : ''
  const quantity = typeof params.quantity === 'string' ? Number(params.quantity) : 1
  const intentId = typeof params.intent === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(params.intent) ? params.intent : ''
  const path = `/store/checkout?${new URLSearchParams({ product: productId, variant: variantId, quantity: String(quantity), ...(intentId ? { intent: intentId } : {}) })}`
  const { user } = await requirePageUser(buildLoginRedirect(path))
  return <StoreCheckout key={`${user.id}:${intentId}:${productId}:${variantId}:${quantity}`} userId={user.id} productId={productId} variantId={variantId} quantity={quantity} intentId={intentId} />
}
