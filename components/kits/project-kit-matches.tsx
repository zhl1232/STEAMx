import Link from 'next/link'
import { KIT_MATERIAL_NOTICE } from '@/lib/kits/types'
import type { getProjectKitMatches } from '@/lib/kits/service'

export function ProjectKitMatches({ matches }: { matches: Awaited<ReturnType<typeof getProjectKitMatches>> }) {
  const linked = matches.filter(match => match.offers.length || match.linkedOffers.length)
  if (!linked.length) return null
  return <section className="mt-5 space-y-4 border-t pt-4" aria-label="对应套装">
    <h3 className="text-sm font-semibold">对应套装</h3>
    {linked.map(match => <div key={match.kit.id} className="text-sm leading-6">
      {(match.linkedOffers.length ? match.linkedOffers : match.offers).map(offer => <Link key={offer.id} href={`/store/products/${offer.productId}?variant=${offer.id}`} className="block font-medium text-primary underline underline-offset-4">{match.kit.name}</Link>)}
      {match.kit.kind !== 'material_pack' && match.preparationStatus === 'extras' ? <p>还需自备：{match.extras.join('、')}</p> : null}
    </div>)}
    {linked.some(match => match.kit.kind !== 'material_pack') ? <p className="text-xs leading-6 text-muted-foreground">{KIT_MATERIAL_NOTICE}</p> : null}
  </section>
}
