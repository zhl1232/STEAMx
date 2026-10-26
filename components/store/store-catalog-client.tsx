'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Package, ShoppingBag } from 'lucide-react'
import { AppWideShell } from '@/components/layout/app-shell'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { OptimizedImage } from '@/components/ui/optimized-image'

export type StoreProduct = {
  id: string; name: string; description?: string | null; cover_url?: string | null
  gallery_urls?: string[]; detail_content?: string | null; video_url?: string | null; category?: string | null
  price_cents: number; shipping_cents: number | null; fulfillment_description?: string | null; blocked_provinces?: string[]
  variants: Array<{ id: string; name: string; price_cents: number | null; stock_quantity: number; min_quantity: number; status?: string; stock_pending?: boolean }>
}
export const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`
export async function storeJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '暂时无法加载，请稍后重试')
  return body
}
export function StoreCatalogClient() {
  const [products, setProducts] = useState<StoreProduct[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void storeJson<{ products: StoreProduct[] }>('/api/store/products').then(({ products }) => { if (active) setProducts(products) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])
  return <main><AppWideShell className="pb-24 pt-8">
    <div className="flex items-center justify-between gap-3"><p className="section-kicker flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> 创探实物商店</p><Button asChild variant="outline" shape="pill" className="h-11"><Link href="/store/orders">我的订单</Link></Button></div>
    <header className="py-10 sm:py-16"><h1 className="text-page-title">让好奇心，动起手来。</h1><p className="mt-4 text-muted-foreground">挑选适合的积木与探索材料，把屏幕里的灵感带到桌面上。</p><p className="mt-3 text-sm text-muted-foreground">会员商品 8.8 折 · 创始会员商品 8 折 · 运费不参与折扣</p></header>
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    {!products && !error ? <p role="status">正在准备商品…</p> : null}
    {products?.length === 0 ? <Surface className="p-10 text-center"><Package className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h2 className="text-panel-title">商品正在准备中</h2><p className="mt-2 text-sm text-muted-foreground">你可以先浏览课程的材料要求，使用手边已有的材料开始探索。</p><Button asChild variant="outline" shape="pill" className="mt-5 h-11"><Link href="/courses">浏览课程</Link></Button></Surface> : null}
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{products?.map(product => <Surface key={product.id} interactive className="overflow-hidden"><Link href={`/store/products/${product.id}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><div className="relative aspect-[4/3] bg-muted/30">{product.cover_url ? <OptimizedImage src={product.cover_url} alt={product.name} fill variant="thumbnail" className="object-contain" /> : <Package className="absolute inset-0 m-auto h-12 w-12 text-muted-foreground" />}</div><div className="p-6"><p className="text-label text-muted-foreground">{product.category || '探索材料'}</p><h2 className="mt-2 text-panel-title">{product.name}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{product.description}</p><div className="mt-6 flex items-center justify-between"><span className="text-xl font-semibold">{money(Math.min(...(product.variants.length ? product.variants.map(v => v.price_cents ?? product.price_cents) : [product.price_cents])))}<span className="ml-1 text-xs font-normal text-muted-foreground">起</span></span><ArrowRight aria-hidden className="h-5 w-5 text-primary" /></div></div></Link></Surface>)}</div>
  </AppWideShell></main>
}
