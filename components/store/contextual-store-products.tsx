import { ExternalLink, Package } from 'lucide-react'

import { OptimizedImage } from '@/components/ui/optimized-image'
import type { PublicStoreProduct } from '@/lib/store/service'

export function ContextualStoreProducts({
  products,
  contextLabel,
  idSuffix = 'default',
  embedded = false,
  materialAmount,
}: {
  products: PublicStoreProduct[]
  contextLabel: string
  idSuffix?: string
  embedded?: boolean
  materialAmount?: string
}) {
  const purchasable = products.filter((product): product is PublicStoreProduct & { external_url: string } => Boolean(product.external_url))
  if (!purchasable.length) return null
  const headingId = `contextual-store-products-heading-${idSuffix}`

  return (
    <section
      className={materialAmount !== undefined ? '' : embedded ? 'mt-5 border-t border-border/60 pt-4' : 'surface-panel overflow-hidden rounded-md border border-[hsl(var(--brand-amber)/0.2)] md:rounded-lg'}
      aria-labelledby={materialAmount === undefined ? headingId : undefined}
      aria-label={materialAmount !== undefined ? '材料包' : undefined}
    >
      {materialAmount === undefined ? <div className={`flex items-center justify-between gap-3 ${embedded ? 'pb-3' : 'px-4 py-3 sm:px-5'}`}>
        <h2 id={headingId} className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
          {contextLabel}材料包
        </h2>
        <p className="shrink-0 text-[11px] leading-4 text-muted-foreground">淘宝完成交易</p>
      </div> : null}

      <div className={embedded ? 'grid gap-4 xl:grid-cols-2' : 'grid gap-2.5 px-3 pb-3 sm:grid-cols-2 sm:px-4 sm:pb-4 lg:grid-cols-3'}>
        {purchasable.map((product) => {
          const price = product.variants[0]?.price_cents ?? product.price_cents
          return (
            <article key={product.id} className={`flex min-w-0 gap-3 ${embedded ? '' : 'rounded-sm border border-border/70 bg-background/80 p-3'}`}>
              <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-sm bg-muted">
                {product.cover_url ? <OptimizedImage src={product.cover_url} alt="" fill variant="thumbnail" className="object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><Package className="h-6 w-6" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-6 wrap-anywhere">{product.name}</h3>
                  {materialAmount ? <span className="shrink-0 text-sm leading-6 text-muted-foreground">{materialAmount}</span> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{price > 0 ? `参考价 ¥${(price / 100).toFixed(2)} 起` : '价格以淘宝页面为准'}</p>
                <a href={product.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-semibold text-[hsl(var(--brand-blue))] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  去淘宝购买
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
