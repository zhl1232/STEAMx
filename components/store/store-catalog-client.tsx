'use client'

import Link from 'next/link'
import type { ExperimentKit } from '@/lib/kits/types'
import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import { AppWideShell } from '@/components/layout/app-shell'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Skeleton } from '@/components/ui/skeleton'
import { StoreHeader } from './store-header'
import { StorePrice, storeMoney, useStoreMembershipTier } from './store-price'

export type StoreProduct = {
  id: string; name: string; description?: string | null; cover_url?: string | null
  gallery_urls?: string[]; detail_content?: string | null; video_url?: string | null; category?: string | null
  price_cents: number; shipping_cents: number | null; fulfillment_description?: string | null; blocked_provinces?: string[]; shipping_province_overrides?: Record<string, number>
  variants: Array<{ id: string; name: string; price_cents: number | null; stock_quantity: number; min_quantity: number; status?: string; stock_pending?: boolean; kit?: ExperimentKit }>
}
export const money = storeMoney
export async function storeJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '暂时无法加载，请稍后重试')
  return body
}
const catalogGrid = 'grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 2xl:grid-cols-5'

function productPrice(product: StoreProduct) {
  const prices = product.variants.length
    ? product.variants.map(variant => variant.price_cents ?? product.price_cents)
    : [product.price_cents]
  const minimum = Math.min(...prices)
  return { minimum, varies: prices.some(price => price !== minimum) }
}

export function StoreCatalogClient() {
  const tier = useStoreMembershipTier()
  const [products, setProducts] = useState<StoreProduct[] | null>(null)
  const [error, setError] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [category, setCategory] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void storeJson<{ products: StoreProduct[] }>('/api/store/products')
      .then(({ products }) => { if (active) setProducts(products) })
      .catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [requestKey])

  const categories = Array.from(new Set(products?.map(product => product.category || '探索材料') ?? []))
  const visibleProducts = (products ?? []).filter(product => category === null || (product.category || '探索材料') === category)

  return <AppWideShell className="pb-24 pt-2 sm:pt-5">
    <h1 className="sr-only">材料商城</h1>
    <StoreHeader categories={<div aria-label="商品分类" className="flex min-w-0 items-center gap-5 overflow-x-auto sm:gap-7">
      {[null, ...categories].map(item => <button key={item ?? '__all'} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`min-h-11 shrink-0 border-b-2 text-sm transition-colors ${category === item ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{item ?? '全部商品'}</button>)}
    </div>} />

    {error ? <Surface className="flex flex-wrap items-center justify-between gap-4 p-6">
      <p role="alert" className="text-sm text-destructive">{error}</p>
      <Button variant="outline" onClick={() => { setError(''); setRequestKey(key => key + 1) }}>重新加载</Button>
    </Surface> : null}
    {!products && !error ? <div role="status" aria-label="正在准备商品">
      <span className="sr-only">正在准备商品…</span>
      <div aria-hidden className={catalogGrid}>{Array.from({ length: 6 }, (_, index) => <div key={index}>
        <Skeleton className="aspect-square rounded-md" />
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Skeleton className="mt-3 h-6 w-20" />
      </div>)}</div>
    </div> : null}
    {products?.length === 0 ? <Surface className="p-10 text-center">
      <Package aria-hidden className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
      <h2 className="text-panel-title">商品正在准备中</h2>
      <p className="mt-2 text-sm text-muted-foreground">你可以先浏览课程的材料要求，使用手边已有的材料开始探索。</p>
      <Button asChild variant="outline" shape="pill" className="mt-5 h-11"><Link href="/courses">浏览课程</Link></Button>
    </Surface> : null}
    {products && products.length > 0 && visibleProducts.length === 0 ? <div className="py-16 text-center">
      <Package aria-hidden className="mx-auto mb-4 h-7 w-7 text-muted-foreground" />
      <h2 className="text-panel-title">这个分类暂无商品</h2>
      <p className="mt-2 text-sm text-muted-foreground">可以查看其他分类的商品。</p>
      <Button variant="outline" className="mt-5 h-11" onClick={() => setCategory(null)}>查看全部商品</Button>
    </div> : null}

    <div className={catalogGrid}>{visibleProducts.map(product => {
      const price = productPrice(product)
      return <article key={product.id} className="min-w-0">
        <Link href={`/store/products/${product.id}`} className="group flex h-full flex-col rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <div className="relative aspect-square overflow-hidden rounded-md bg-muted/60">
            {product.cover_url ? <OptimizedImage src={product.cover_url} alt={product.name} fill variant="card" sizes="(max-width: 639px) 46vw, (max-width: 1023px) 30vw, (max-width: 1535px) 23vw, 340px" className="object-contain p-5 transition-transform duration-300 motion-safe:group-hover:scale-105 sm:p-8" /> : <Package aria-hidden className="absolute inset-0 m-auto h-10 w-10 text-muted-foreground/50" />}
          </div>
          <div className="flex flex-1 flex-col pt-4">
            <h2 className="break-words text-sm font-semibold leading-6 group-hover:text-primary sm:text-base">{product.name}</h2>
            {product.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.description}</p> : null}
            <div className="mt-auto pt-3"><StorePrice cents={price.minimum} tier={tier} varies={price.varies} /></div>
            {product.shipping_cents != null && product.shipping_cents > 0 ? <p className="mt-2 text-xs text-muted-foreground">运费 {money(product.shipping_cents)}</p> : null}
          </div>
        </Link>
      </article>
    })}</div>
  </AppWideShell>
}
