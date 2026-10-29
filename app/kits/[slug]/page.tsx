import { notFound, redirect } from 'next/navigation'
import { getKit, getKitOffers } from '@/lib/kits/service'

export const dynamic = 'force-dynamic'

// Keep existing links working without rendering an intermediate detail page.
export default async function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  const kit = await getKit((await params).slug)
  if (!kit) notFound()
  const [offer] = await getKitOffers(kit)
  if (!offer) notFound()
  redirect(`/store/products/${offer.productId}?variant=${offer.id}`)
}
