import { isStoreCatalogVisible } from '@/lib/store/config'
import type { getProjectKitMatches } from '@/lib/kits/service'
import { MaterialPackCard } from '@/components/store/material-pack-card'

// Match only the nine imported 2026 science-pack specifications.
function materialPackSpecification(name: string): string {
  const imported = name.match(/^2026(幼儿园[小中大]班|[一二三四五六]年级)16件套\+说明书$/u)
  if (!imported) return name
  const grade = imported[1]
  return `${grade.startsWith('幼儿园') ? grade : `小学${grade}`} · 16件套`
}

export function ProjectKitMatches({ matches, embedded = false }: {
  matches: Awaited<ReturnType<typeof getProjectKitMatches>>
  embedded?: boolean
}) {
  const linked = matches.filter(match => match.offers.length || match.linkedOffers.length)
  if (!isStoreCatalogVisible() || !linked.length) return null
  const packs = linked.filter(match => match.kit.kind === 'material_pack')
  const general = linked.filter(match => match.kit.kind === 'general_materials')
  type Match = typeof linked[number]
  type Offer = Match['linkedOffers'][number]
  const groups = new Map<string, { match: Match; offers: Map<string, Offer> }>()
  for (const match of general) {
    for (const offer of match.linkedOffers.length ? match.linkedOffers : match.offers) {
      const group = groups.get(offer.productId) ?? { match, offers: new Map<string, Offer>() }
      group.offers.set(offer.id, offer)
      groups.set(offer.productId, group)
    }
  }
  const extras = [...new Set(linked.flatMap(match => match.confirmed && match.preparationStatus === 'extras' ? match.extras : []))]
  return <section className={embedded ? 'space-y-4' : 'mt-5 space-y-4 border-t border-border/60 pt-4'} aria-label="对应材料包">
    <p className="text-sm leading-6 text-muted-foreground">还没有材料？可以选购实验材料包。</p>
    {packs.map(match => <div key={match.kit.id} className="space-y-3 text-sm leading-6">
      {(match.linkedOffers.length ? match.linkedOffers : match.offers).map(offer => <MaterialPackCard
        key={offer.id}
        name={offer.productName || match.kit.name}
        variantName={match.kit.kind === 'material_pack' ? materialPackSpecification(offer.name) : offer.name}
        imageUrl={match.kit.cover_url}
        href={`/store/products/${encodeURIComponent(offer.productId)}?variant=${encodeURIComponent(offer.id)}`}
      />)}
    </div>)}
    {groups.size ? <div className="space-y-3">
      {[...groups].map(([productId, { match, offers }]) => {
        const first = offers.values().next().value!
        const only = offers.size === 1 ? first : undefined
        return <MaterialPackCard key={productId} name={first.productName || match.kit.name}
          imageUrl={match.kit.cover_url} variantName={only?.name}
          href={`/store/products/${encodeURIComponent(productId)}${only ? `?variant=${encodeURIComponent(only.id)}` : ''}`} />
      })}
    </div> : null}
    {extras.length ? <p className="text-sm leading-6">还需自备：{extras.join('、')}</p> : null}
  </section>
}
