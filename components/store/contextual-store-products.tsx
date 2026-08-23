import { ExternalLink, Package } from 'lucide-react'

import { OptimizedImage } from '@/components/ui/optimized-image'
import type { PublicStoreProduct } from '@/lib/store/service'

export function ContextualStoreProducts({
  products,
  contextLabel,
  idSuffix = 'default',
}: {
  products: PublicStoreProduct[]
  contextLabel: string
  idSuffix?: string
}) {
  const purchasable = products.filter((product): product is PublicStoreProduct & { external_url: string } => Boolean(product.external_url))
  if (!purchasable.length) return null
  const headingId = `contextual-store-products-heading-${idSuffix}`

  return (
    <section
      className="surface-panel overflow-hidden rounded-md border border-[hsl(var(--brand-amber)/0.2)] md:rounded-lg"
      aria-labelledby={headingId}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h2 id={headingId} className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
          {contextLabel}材料包
        </h2>
        <p className="shrink-0 text-[11px] leading-4 text-muted-foreground">淘宝完成交易</p>
      </div>

      <div className="grid gap-2.5 px-3 pb-3 sm:grid-cols-2 sm:px-4 sm:pb-4 lg:grid-cols-3">
        {purchasable.map((product) => {
          const price = product.variants[0]?.price_cents ?? product.price_cents
          return (
            <article key={product.id} className="flex min-w-0 gap-3 rounded-sm border border-border/70 bg-background/80 p-3">
              <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-sm bg-muted">
                {product.cover_url ? <OptimizedImage src={product.cover_url} alt="" fill variant="thumbnail" className="object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><Package className="h-6 w-6" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-foreground">{product.name}</h3>
                <p className="mt-1 text-xs font-semibold text-primary">参考价 ¥{(price / 100).toFixed(2)} 起</p>
                <a href={product.external_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#e64a00] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5000] focus-visible:ring-offset-2">
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
