'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Minus, Package, Plus } from 'lucide-react'
import { AppWideShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { money, type StoreProduct } from './store-catalog-client'
import { StoreHeader } from './store-header'
import { StorePrice, useStoreMembershipTier } from './store-price'

export function StoreProductDetail({ product, checkoutEnabled, preview }: { product: StoreProduct; checkoutEnabled: boolean; preview?: { status: string; publicProductHref?: string } }) {
  const router = useRouter()
  const tier = useStoreMembershipTier()
  const [variantId, setVariantId] = useState(product.variants[0]?.id || '')
  const variant = product.variants.find(v => v.id === variantId)
  const [quantity, setQuantity] = useState(variant?.min_quantity || 1)
  const images = [...new Set([product.cover_url, ...(product.gallery_urls || [])].filter((url): url is string => Boolean(url)))]
  const [image, setImage] = useState(images[0])
  const unit = variant?.price_cents ?? product.price_cents
  const minimum = variant?.min_quantity || 1
  const maximum = Math.min(100, variant?.stock_quantity || 0)
  const available = variant && !variant.stock_pending && variant.stock_quantity >= quantity && quantity >= variant.min_quantity && Number.isInteger(quantity) && quantity <= 100
  const purchaseLabel = preview ? '预览期间不发起购买'
    : !checkoutEnabled ? '购买暂未开放'
    : !variant ? '暂无可售规格'
    : variant.stock_pending ? '库存待确认'
    : variant.stock_quantity < minimum ? '暂时缺货'
    : !Number.isInteger(quantity) || quantity < minimum || quantity > 100 ? '请选择有效数量'
    : quantity > variant.stock_quantity ? '库存不足'
    : '立即购买'
  const variantStatus = (value: StoreProduct['variants'][number]) => preview && value.status !== 'active' ? '已暂停' : value.stock_pending ? '库存待确认' : value.stock_quantity < value.min_quantity ? '暂缺货' : ''
  const statusText = preview?.status === 'active' ? '已上架' : preview?.status === 'archived' ? '已归档' : '草稿'

  return <AppWideShell className="pb-[calc(7rem+env(safe-area-inset-bottom))] pt-2 md:pb-16 md:pt-5">
    <StoreHeader back={{ href: preview ? `/admin/store?product=${product.id}` : '/store', label: preview ? '← 返回编辑商品' : '返回商城' }} />
    {preview ? <div className="mt-5 rounded-md bg-muted/60 p-4" role="status"><p className="font-semibold">管理员商品预览 · {statusText}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">正在读取已保存的商品资料。库存、运费和发货安排以后台记录为准；请回到商品编辑页补齐待确认项。</p>{preview.publicProductHref ? <Button asChild variant="outline" className="mt-3 h-11"><Link href={preview.publicProductHref}>查看正式商品页面</Link></Button> : null}</div> : null}

    <div className="grid items-start gap-7 pt-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] md:gap-8 xl:grid-cols-[minmax(0,560px)_minmax(0,640px)] xl:gap-12">
      <div className="min-w-0">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/60">
          {image ? <OptimizedImage src={image} alt={product.name} fill variant="cover" sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) 44vw, 560px" className="object-contain p-8 sm:p-14" /> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"><Package aria-hidden className="h-12 w-12" /><p className="text-sm">商品图片准备中</p></div>}
        </div>
        {images.length > 1 ? <div className="mt-4 flex gap-3 overflow-x-auto pb-2">{images.map((url, i) => <button type="button" key={url} aria-label={`查看商品图片 ${i + 1}`} aria-pressed={image === url} onClick={() => setImage(url)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-sm border bg-muted/50 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:h-20 sm:w-20 ${image === url ? 'border-foreground' : 'border-transparent hover:border-border'}`}><OptimizedImage src={url} alt="" fill variant="thumbnail" className="object-contain p-2" /></button>)}</div> : null}
      </div>

      <section className="min-w-0 md:py-2">
        <p className="text-xs text-muted-foreground">{product.category || '探索材料'}</p>
        <h1 className="mt-3 text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">{product.name}</h1>
        {product.description ? <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{product.description}</p> : null}
        <div className="border-b border-border/70 py-6 sm:py-7"><StorePrice cents={unit} tier={tier} large /></div>

        {product.variants.length === 1 && variant ? <div className="mt-6 flex items-start gap-5 text-sm leading-6"><span className="shrink-0 font-medium">规格</span><div><p>{variant.name}</p>{variantStatus(variant) ? <p className="mt-1 text-xs text-muted-foreground">{variantStatus(variant)}</p> : null}</div></div> : <fieldset className="mt-6"><legend className="mb-3 text-sm font-medium">选择规格</legend><div className="flex flex-wrap gap-2.5">{product.variants.map(value => <button type="button" key={value.id} className={`min-h-11 rounded-sm border px-4 py-2.5 text-left text-sm leading-6 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${variantId === value.id ? 'border-primary bg-primary/5' : 'border-border bg-transparent hover:border-foreground/50'} ${variantStatus(value) ? 'text-muted-foreground' : 'text-foreground'}`} aria-pressed={variantId === value.id} onClick={() => { setVariantId(value.id); setQuantity(value.min_quantity) }}>{value.name}{variantStatus(value) ? `（${variantStatus(value)}）` : ''}</button>)}</div></fieldset>}


        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <label htmlFor="store-quantity" className="text-sm font-medium">数量</label>
          <div className="inline-flex h-11 items-center overflow-hidden rounded-sm border border-border">
            <button type="button" aria-label="减少数量" disabled={!Number.isInteger(quantity) || quantity <= minimum} onClick={() => setQuantity(value => Math.max(minimum, value - 1))} className="flex h-11 w-11 items-center justify-center hover:bg-muted disabled:opacity-30"><Minus aria-hidden className="h-4 w-4" /></button>
            <Input id="store-quantity" aria-label="数量" className="h-10 w-14 rounded-none border-0 bg-transparent px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" type="number" min={minimum} max={maximum} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            <button type="button" aria-label="增加数量" disabled={!Number.isInteger(quantity) || quantity >= maximum} onClick={() => setQuantity(value => Math.min(maximum, value + 1))} className="flex h-11 w-11 items-center justify-center hover:bg-muted disabled:opacity-30"><Plus aria-hidden className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground">{variant ? `${variant.stock_pending ? '库存待确认' : `可售 ${variant.stock_quantity} 件`} · ${variant.min_quantity} 件起订` : '暂无可售规格'}</p>
        </div>

        <dl className="mt-6 space-y-3 border-t border-border/70 pt-5 text-sm leading-6">
          <div className="grid grid-cols-[3rem_1fr] gap-3"><dt className="text-muted-foreground">配送</dt><dd>{product.shipping_cents == null ? '每单运费待确认' : product.shipping_cents === 0 ? '免运费' : `每单运费 ${money(product.shipping_cents)}`}</dd></div>
          <div className="grid grid-cols-[3rem_1fr] gap-3"><dt className="text-muted-foreground">发货</dt><dd>{product.fulfillment_description || (preview ? '发货安排待确认' : '发货安排以结算页说明为准。')}</dd></div>
          {product.blocked_provinces?.length ? <div className="grid grid-cols-[3rem_1fr] gap-3"><dt className="text-muted-foreground">区域</dt><dd className="text-muted-foreground">暂不配送：{product.blocked_provinces.join('、')}</dd></div> : null}
        </dl>
        <div aria-label="商品购买" className={preview ? 'mt-7 flex max-w-lg gap-3' : 'fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:mt-7 md:max-w-lg md:border-0 md:bg-transparent md:p-0'}>
          <Button asChild variant="outline" className="h-12 shrink-0 px-5 md:order-2"><Link href={preview ? '/store/support' : `/store/support?productId=${product.id}`}>{preview ? '联系商城客服' : '客服'}</Link></Button>
          <Button disabled={Boolean(preview) || !checkoutEnabled || !available} tone="brand" className="h-12 min-w-0 flex-1 whitespace-normal px-3 leading-5" onClick={() => { if (!preview && checkoutEnabled && available) router.push(`/store/checkout?product=${product.id}&variant=${variantId}&quantity=${quantity}&intent=${crypto.randomUUID()}`) }}>{purchaseLabel}</Button>
        </div>
      </section>
    </div>

    <section className="mt-12 border-t border-border/70 pt-6 sm:mt-16 sm:pt-8"><h2 className="text-lg font-semibold">商品详情</h2><p className="mt-5 max-w-prose whitespace-pre-line text-sm leading-8 text-muted-foreground">{product.detail_content || product.description || '更多商品信息正在准备中。'}</p>{product.video_url ? <video controls preload="none" poster={product.cover_url || undefined} className="mt-6 w-full rounded-md" src={product.video_url}><track kind="captions" />你的浏览器暂不支持视频播放。</video> : null}</section>
  </AppWideShell>
}
