import type { PublicStoreProduct } from '@/lib/store/service'
import { isStoreCatalogVisible } from '@/lib/store/config'
import { MaterialPackCard } from './material-pack-card'

export function ContextualStoreProducts({ products, contextLabel, idSuffix = 'default', embedded = false, materialAmount }: {
  products: PublicStoreProduct[]
  contextLabel: string
  idSuffix?: string
  embedded?: boolean
  materialAmount?: string
}) {
  if (!isStoreCatalogVisible() || !products.length) return null
  const headingId = `contextual-store-products-heading-${idSuffix}`
  return (
    <section className={materialAmount !== undefined ? '' : embedded ? 'mt-5 border-t border-border/60 pt-4' : 'surface-panel rounded-md p-4 sm:p-5'}
      aria-labelledby={materialAmount === undefined ? headingId : undefined}
      aria-label={materialAmount !== undefined ? '材料包' : undefined}>
      {materialAmount === undefined ? <h2 id={headingId} className="mb-3 text-sm font-semibold">{contextLabel}材料包</h2> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {products.map(product => {
          const variant = product.variants.length === 1 ? product.variants[0] : undefined
          const href = `/store/products/${encodeURIComponent(product.id)}${variant ? `?variant=${encodeURIComponent(variant.id)}` : ''}`
          return <MaterialPackCard key={product.id} name={product.name} variantName={variant?.name} imageUrl={product.cover_url} href={href} materialAmount={materialAmount} />
        })}
      </div>
    </section>
  )
}
