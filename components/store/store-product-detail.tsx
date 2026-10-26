'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppWideShell } from '@/components/layout/app-shell'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { money, type StoreProduct } from './store-catalog-client'

export function StoreProductDetail({ product, checkoutEnabled, preview }: { product: StoreProduct; checkoutEnabled: boolean; preview?: { status: string; publicProductHref?: string } }) {
  const router = useRouter()
  const [variantId, setVariantId] = useState(product.variants[0]?.id || '')
  const variant = product.variants.find(v => v.id === variantId)
  const [quantity, setQuantity] = useState(variant?.min_quantity || 1)
  const images = [...new Set([product.cover_url, ...(product.gallery_urls || [])].filter((url): url is string => Boolean(url)))]
  const [image, setImage] = useState(images[0])
  const unit = variant?.price_cents ?? product.price_cents
  const available = variant && !variant.stock_pending && variant.stock_quantity >= quantity && quantity >= variant.min_quantity && Number.isInteger(quantity) && quantity <= 100
  const statusText = preview?.status === 'active' ? '已上架' : preview?.status === 'archived' ? '已归档' : '草稿'
  return <main><AppWideShell className="pb-24 pt-8"><nav aria-label="商城导航" className="flex items-center justify-between gap-3"><Button asChild variant="ghost" className="h-11"><Link href={preview ? `/admin/store?product=${product.id}` : '/store'}>{preview ? '← 返回编辑商品' : '← 全部商品'}</Link></Button><Button asChild variant="outline" shape="pill" className="h-11"><Link href="/store/orders">我的订单</Link></Button></nav>
    {preview ? <Surface variant="subtle" className="mt-5 space-y-2 p-4" role="status"><p className="font-semibold">管理员商品预览 · {statusText}</p><p className="text-sm leading-6 text-muted-foreground">正在读取已保存的商品资料。库存、运费和发货安排以后台记录为准；请回到商品编辑页补齐待确认项。</p>{preview.publicProductHref ? <Button asChild variant="outline" shape="pill" className="h-11"><Link href={preview.publicProductHref}>查看正式商品页面</Link></Button> : null}</Surface> : null}
    <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
      <div><Surface className="relative aspect-square overflow-hidden bg-muted/20">{image ? <OptimizedImage src={image} alt={product.name} fill className="object-contain" /> : <p className="p-10 text-muted-foreground">商品图片准备中</p>}</Surface>{images.length > 1 ? <div className="mt-3 flex gap-3 overflow-x-auto pb-2">{images.map((url, i) => <Button type="button" variant="outline" key={url} aria-label={`查看商品图片 ${i + 1}`} aria-pressed={image === url} onClick={() => setImage(url)} className={`relative h-20 w-20 shrink-0 overflow-hidden border-2 p-0 ${image === url ? 'border-primary' : 'border-transparent'}`}><OptimizedImage src={url} alt="" fill variant="thumbnail" className="object-contain" /></Button>)}</div> : null}</div>
      <section className="lg:py-4"><p className="section-kicker">{product.category || '探索材料'}</p><h1 className="mt-3 text-page-title">{product.name}</h1><p className="mt-4 whitespace-pre-line leading-7 text-muted-foreground">{product.description}</p><div className="mt-6"><p className="text-3xl font-semibold">{money(unit)}</p><p className="mt-3 text-sm text-muted-foreground">Pro 会员 {money(Math.round(unit * .88))} · 创始会员 {money(Math.round(unit * .8))}</p><p className="mt-1 text-xs text-muted-foreground">有效会员享商品折扣，到期恢复原价；运费不打折。最终价格以结算报价为准。</p></div>
      <fieldset className="mt-7"><legend className="mb-3 text-sm font-semibold">选择规格</legend><div className="flex flex-wrap gap-2">{product.variants.map(v => <Button key={v.id} variant={variantId === v.id ? 'default' : 'outline'} tone={variantId === v.id ? 'brand' : undefined} className="h-auto min-h-11 whitespace-normal text-left" aria-pressed={variantId === v.id} onClick={() => { setVariantId(v.id); setQuantity(v.min_quantity) }}>{v.name}{preview && v.status !== 'active' ? '（已暂停）' : v.stock_pending ? '（库存待确认）' : v.stock_quantity < v.min_quantity ? '（暂缺货）' : ''}</Button>)}</div></fieldset>
      <label className="mt-5 block text-sm font-semibold">数量<Input aria-label="数量" className="mt-2 w-28" type="number" min={variant?.min_quantity || 1} max={Math.min(100, variant?.stock_quantity || 0)} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label><p className="mt-2 text-sm text-muted-foreground">{variant ? `${variant.stock_pending ? '库存待确认' : `可售 ${variant.stock_quantity} 件`} · ${variant.min_quantity} 件起订` : '暂无可售规格'}</p>
      <Surface variant="subtle" className="mt-6 p-4 text-sm leading-6"><p>{product.shipping_cents == null ? '每单运费待确认' : `每单运费 ${money(product.shipping_cents)}`}</p><p className="mt-1">{product.fulfillment_description || (preview ? '发货安排待确认' : '发货安排以结算页说明为准。')}</p>{product.blocked_provinces?.length ? <p className="mt-1">暂不配送：{product.blocked_provinces.join('、')}</p> : null}</Surface>
      <div className="mt-6 flex flex-wrap gap-3">{!preview && checkoutEnabled && available ? <Button tone="brand" shape="pill" className="h-12 flex-1" onClick={() => router.push(`/store/checkout?product=${product.id}&variant=${variantId}&quantity=${quantity}&intent=${crypto.randomUUID()}`)}>立即购买</Button> : <Button disabled tone="brand" shape="pill" className="h-12 flex-1">{preview ? '预览期间不发起购买' : checkoutEnabled ? '该规格或数量暂不可购' : '购买暂未开放'}</Button>}<Button asChild variant="outline" shape="pill" className="h-12"><Link href={preview ? '/store/support' : `/store/support?productId=${product.id}`}>{preview ? '联系商城客服' : '咨询商品'}</Link></Button></div>
      </section>
    </div>
    <Surface className="mt-12 p-6 sm:p-9"><h2 className="text-panel-title">认识这件材料</h2><p className="mt-5 whitespace-pre-line leading-8 text-muted-foreground">{product.detail_content || product.description || '更多商品信息正在准备中。'}</p>{product.video_url ? <video controls preload="none" poster={product.cover_url || undefined} className="mt-6 w-full rounded-md" src={product.video_url}><track kind="captions" />你的浏览器暂不支持视频播放。</video> : null}</Surface>
  </AppWideShell></main>
}
