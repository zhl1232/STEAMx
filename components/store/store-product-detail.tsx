'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowUpRight, Minus, Package, Plus } from 'lucide-react'
import { AppWideShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { money, type StoreProduct } from './store-catalog-client'
import { RecentKit } from '@/components/kits/recent-kit'
import { StoreHeader } from './store-header'
import { StorePrice, useStoreMembershipTier } from './store-price'
import { useReturnHref } from '@/components/navigation/return-href'

export function StoreProductDetail({ product, checkoutEnabled, preview, requestedVariantId }: { product: StoreProduct; checkoutEnabled: boolean; requestedVariantId?: string; preview?: { status: string; publicProductHref?: string } }) {
  const router = useRouter()
  const returnHref = useReturnHref('/store')
  const returnLabel = returnHref.startsWith('/project/') ? '返回项目'
    : /^\/courses(?:[/?]|$)/.test(returnHref) ? '返回课程'
    : /^\/store(?:[/?]|$)/.test(returnHref) ? '返回商城' : '返回上一页'
  const tier = useStoreMembershipTier()
  const [variantId, setVariantId] = useState(requestedVariantId ?? product.variants[0]?.id ?? '')
  const variant = product.variants.find(v => v.id === variantId)
  const [quantity, setQuantity] = useState(variant?.min_quantity || 1)
  const kit = variant?.kit
  const introductionImages = product.gallery_urls?.filter(url => url.startsWith('/store/science-kits/intro-')) ?? []
  const productGalleryImages = product.gallery_urls?.filter(url => !url.startsWith('/store/science-kits/intro-')) ?? []
  const kitPresentationImages = kit?.gallery_urls.filter(url => url.startsWith('/store/science-kits/display-')) ?? []
  const kitDetailImages = kit?.gallery_urls.filter(url => !url.startsWith('/store/science-kits/display-')) ?? []
  const selectedPresentationImages = kitPresentationImages.length ? kitPresentationImages : kit?.cover_url ? [kit.cover_url] : []
  const images = [...new Set((kit ? [kit.cover_url, ...kitPresentationImages, ...productGalleryImages] : [product.cover_url, ...productGalleryImages]).filter((url): url is string => Boolean(url)))]
  const preparationNotes = kit?.preparation_note
    .replace('文字目录为已录入部分，完整供应商目录请查看下方原图。', '')
    .replace('器材可重复使用，耗材用完后需补充。', '器材可重复使用，耗材用完需补充。')
    .replace('实验目录列出适用实验，不表示一套材料能将全部实验各完成一次。', '实验目录仅供选择，不代表耗材足够完成全部实验。')
    .replace('请按单次用量取用并妥善保存，水、鸡蛋、盐等日常材料按项目清单自备。', '每次按需取用；水、鸡蛋、盐等日常材料需自备。')
    .split(/。|\n/).map(note => note.trim()).filter(Boolean) ?? []
  const detailText = product.detail_content?.trim()
  const showDetailText = Boolean(detailText && detailText !== product.description?.trim() && !kit?.preparation_note.includes(detailText))
  const [selectedImage, setImage] = useState<string | undefined>()
  const image = selectedImage && images.includes(selectedImage) ? selectedImage : images[0]
  const unit = variant?.price_cents ?? product.price_cents
  const minimum = variant?.min_quantity || 1
  const maximum = Math.min(100, variant?.stock_quantity || 0)
  const available = variant && !variant.stock_pending && variant.stock_quantity >= quantity && quantity >= variant.min_quantity && Number.isInteger(quantity) && quantity <= 100
  const requestedUnavailable = Boolean(requestedVariantId && !product.variants.some(v => v.id === requestedVariantId))
  const provinceFees = Object.entries(product.shipping_province_overrides ?? {})
  const remoteRegionShipping = product.shipping_cents === 0 && provinceFees.length > 0 && provinceFees.every(([province, fee]) => ['新疆维吾尔自治区', '西藏自治区'].includes(province) && fee > 0)
  const shippingText = remoteRegionShipping ? '非偏远地区包邮' : product.shipping_cents == null ? '每单运费待确认' : Object.keys(product.shipping_province_overrides ?? {}).length ? `${product.shipping_cents === 0 ? '其他大陆地区包邮' : `默认每单 ${money(product.shipping_cents)}`}；${Object.entries(product.shipping_province_overrides ?? {}).map(([province, fee]) => `${province}每单${money(fee)}`).join('，')}` : product.shipping_cents === 0 ? '免运费' : `每单运费 ${money(product.shipping_cents)}`
  const fulfillmentText = product.fulfillment_description?.replace('。中国大陆除新疆、西藏外包邮；新疆、西藏每单运费32元，不随购买数量增加。', '。')
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
    {kit && !preview ? <RecentKit slug={kit.slug} name={kit.name} /> : null}<StoreHeader back={{ href: preview ? `/admin/store?product=${product.id}` : returnHref, label: preview ? '← 返回编辑商品' : returnLabel }} />
    <div className="mx-auto w-full max-w-7xl">
    {preview ? <div className="mt-5 rounded-md bg-muted/60 p-4" role="status"><p className="font-semibold">管理员商品预览 · {statusText}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">正在读取已保存的商品资料。库存、运费和发货安排以后台记录为准；请回到商品编辑页补齐待确认项。</p>{preview.publicProductHref ? <Button asChild variant="outline" className="mt-3 h-11"><Link href={preview.publicProductHref}>查看正式商品页面</Link></Button> : null}</div> : null}

    {requestedUnavailable ? <p role="alert" className="mt-4 text-sm text-destructive">链接中的规格已不可用，请核对材料后重新选择规格。</p> : null}
    <div className="grid items-start gap-7 pt-2 md:grid-cols-2 md:gap-8 lg:gap-12">
      <div className="min-w-0 md:sticky md:top-24">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/60">
          {image ? <OptimizedImage src={image} alt={product.name} fill variant="cover" sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1343px) 46vw, 616px" className="object-contain p-4 sm:p-6" /> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"><Package aria-hidden className="h-12 w-12" /><p className="text-sm">商品图片准备中</p></div>}
        </div>
        {images.length > 1 ? <div className="mt-4 flex gap-3 overflow-x-auto pb-2">{images.map((url, i) => <button type="button" key={url} aria-label={`查看商品图片 ${i + 1}`} aria-pressed={image === url} onClick={() => setImage(url)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-sm border bg-muted/50 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:h-20 sm:w-20 ${image === url ? 'border-foreground' : 'border-transparent hover:border-border'}`}><OptimizedImage src={url} alt="" fill variant="thumbnail" className="object-contain p-2" /></button>)}</div> : null}
      </div>

      <section className="min-w-0 md:py-2">
        {!kit && product.category ? <p className="text-xs text-muted-foreground">{product.category}</p> : null}
        <h1 className="text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">{product.name}</h1>
        {product.description && kit?.kind !== 'material_pack' && !kit?.preparation_note.includes(product.description) ? <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{product.description}</p> : null}
        <div className="border-b border-border/70 py-6 sm:py-7"><StorePrice cents={unit} tier={tier} large /></div>

        {product.variants.length === 1 && variant ? <div className="mt-6 flex items-start gap-5 text-sm leading-6"><span className="shrink-0 font-medium">规格</span><div><p>{variant.name}</p>{variantStatus(variant) ? <p className="mt-1 text-xs text-muted-foreground">{variantStatus(variant)}</p> : null}</div></div> : <fieldset className="mt-6"><legend className="mb-3 text-sm font-medium">选择规格</legend><div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">{product.variants.map(value => <button type="button" key={value.id} className={`min-h-12 rounded-md border px-4 py-3 text-left text-sm leading-6 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${variantId === value.id ? 'border-primary bg-primary/5' : 'border-border bg-transparent hover:border-foreground/50'} ${variantStatus(value) ? 'text-muted-foreground' : 'text-foreground'}`} aria-pressed={variantId === value.id} onClick={() => { setVariantId(value.id); setQuantity(value.min_quantity); setImage(undefined) }}>{value.name}{variantStatus(value) ? `（${variantStatus(value)}）` : ''}</button>)}</div></fieldset>}


        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <label htmlFor="store-quantity" className="text-sm font-medium">数量</label>
          <div className="inline-flex h-11 items-center overflow-hidden rounded-sm border border-border">
            <button type="button" aria-label="减少数量" disabled={!Number.isInteger(quantity) || quantity <= minimum} onClick={() => setQuantity(value => Math.max(minimum, value - 1))} className="flex h-11 w-11 items-center justify-center hover:bg-muted disabled:opacity-30"><Minus aria-hidden className="h-4 w-4" /></button>
            <Input id="store-quantity" aria-label="数量" className="h-10 w-14 rounded-none border-0 bg-transparent px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" type="number" min={minimum} max={maximum} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            <button type="button" aria-label="增加数量" disabled={!Number.isInteger(quantity) || quantity >= maximum} onClick={() => setQuantity(value => Math.min(maximum, value + 1))} className="flex h-11 w-11 items-center justify-center hover:bg-muted disabled:opacity-30"><Plus aria-hidden className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground">{variant ? `${variant.stock_pending ? '库存待确认' : `可售 ${variant.stock_quantity} 件`}${variant.min_quantity > 1 ? ` · ${variant.min_quantity} 件起订` : ''}` : '暂无可售规格'}</p>
        </div>

        <dl className="mt-6 space-y-3 border-t border-border/70 pt-5 text-sm leading-6">
          <div className="grid grid-cols-[3rem_1fr] gap-3"><dt className="text-muted-foreground">配送</dt><dd>{shippingText}</dd></div>
          <div className="grid grid-cols-[3rem_1fr] gap-3"><dt className="text-muted-foreground">发货</dt><dd>{fulfillmentText || (preview ? '发货安排待确认' : '发货安排以结算页说明为准。')}</dd></div>
          {product.blocked_provinces?.length ? <div className="grid grid-cols-[3rem_1fr] gap-3"><dt className="text-muted-foreground">区域</dt><dd className="text-muted-foreground">暂不配送：{product.blocked_provinces.join('、')}</dd></div> : null}
        </dl>
        <div aria-label="商品购买" className={preview ? 'mt-7 flex max-w-lg gap-3' : 'fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:mt-7 md:max-w-lg md:border-0 md:bg-transparent md:p-0'}>
          <Button asChild variant="outline" className="h-12 shrink-0 px-5 md:order-2"><Link href={preview ? '/store/support' : `/store/support?productId=${product.id}`}>{preview ? '联系商城客服' : '客服'}</Link></Button>
          <Button disabled={Boolean(preview) || !checkoutEnabled || !available} tone="brand" className="h-12 min-w-0 flex-1 whitespace-normal px-3 leading-5" onClick={() => { if (!preview && checkoutEnabled && available) router.push(`/store/checkout?product=${product.id}&variant=${variantId}&quantity=${quantity}&intent=${crypto.randomUUID()}`) }}>{purchaseLabel}</Button>
        </div>
      </section>
    </div>

    {introductionImages.length ? <section aria-label="分龄介绍" className="mx-auto mt-12 max-w-3xl space-y-6 sm:mt-16">{introductionImages.map(url => <img key={url} src={url} alt="分龄科学探索介绍（供应商提供）" width={790} height={1500} loading="lazy" className="block h-auto w-full" />)}</section> : null}
    {kit?.kind === 'general_materials' && selectedPresentationImages.length ? <section aria-label="使用展示" className="mx-auto mt-12 max-w-3xl sm:mt-16">
      <div className="space-y-6">{selectedPresentationImages.map((url, index) => <img key={url} src={url} alt={`${kit.name}实物展示 ${index + 1}（供应商提供）`} loading="lazy" className="block h-auto w-full" />)}</div>
    </section> : null}
    {kit ? <section aria-label="所选规格材料" className="mx-auto mt-12 max-w-3xl border-t border-border/70 pt-8 sm:mt-16">
      <div className={kit.kind === 'general_materials' && preparationNotes.length ? "grid items-start gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] sm:gap-8" : undefined}>
        <h2 className="text-xl font-semibold leading-relaxed tracking-tight">{kit.name}</h2>
        {kit.kind === 'general_materials' && preparationNotes.length ? <ul className="space-y-2 text-sm leading-7 text-muted-foreground">{preparationNotes.map(note => <li key={note}>{note}。</li>)}</ul> : null}
      </div>
      {!kitDetailImages.length && kit.materials.length ? <><h3 className="mt-5 font-medium">材料清单</h3><ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{kit.materials.map((material, i) => <li key={i}>{material}</li>)}</ul></> : null}
      {!kitDetailImages.length && kit.catalog.length ? <details className="mt-5 border-y border-border/60 py-3" open={kit.kind === 'general_materials'}><summary className="cursor-pointer text-sm font-medium">盒内实验目录 · {kit.catalog.length} 项{kit.kind === 'general_materials' ? '（已录入）' : ''}</summary><ul className="mt-4 grid gap-x-6 gap-y-2 text-sm leading-6 text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">{kit.catalog.map((title, i) => <li key={i}>{title}</li>)}</ul></details> : null}
      {kit.kind === 'material_pack' && kit.status === 'published' ? <KitProjectLinks key={kit.slug} slug={kit.slug} /> : null}
      {kitDetailImages.length ? <div aria-label="规格详情图" className="mx-auto mt-6 max-w-3xl overflow-hidden">{kitDetailImages.map(url => <img key={url} src={url} alt={`${kit.name}供应商详情`} loading="lazy" className="block h-auto w-full" />)}</div> : null}
    </section> : null}
    {showDetailText || product.video_url ? <section className="mx-auto mt-12 max-w-3xl border-t border-border/70 pt-6 sm:mt-16 sm:pt-8">{showDetailText ? <><h2 className="text-lg font-semibold">商品详情</h2><p className="mt-5 whitespace-pre-line text-sm leading-8 text-muted-foreground">{detailText}</p></> : null}{product.video_url ? <video controls preload="none" poster={product.cover_url || undefined} className="mt-6 w-full rounded-md" src={product.video_url}><track kind="captions" />你的浏览器暂不支持视频播放。</video> : null}</section> : null}
    </div>
  </AppWideShell>
}

type KitProjectLink = {
  project: { id: string | number; title: string }
  confirmed: boolean
  preparationStatus: string
  extras: string[]
}

function KitProjectLinks({ slug }: { slug: string }) {
  const [result, setResult] = useState<{ projects: KitProjectLink[]; hasMore: boolean } | null>(null)
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/kits/${encodeURIComponent(slug)}/projects?page=${page}`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Projects unavailable')
        return response.json()
      })
      .then(data => { if (!controller.signal.aborted) setResult(previous => ({ ...data, projects: page === 0 ? data.projects : [...(previous?.projects ?? []), ...data.projects] })) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [slug, page, attempt])

  return <div className="mt-6">
    <h3 className="font-medium">站内实验教程</h3>
    {failed ? <p className="mt-3 text-sm text-muted-foreground">教程暂时无法加载，请重试。</p>
      : !result ? <p role="status" className="mt-3 text-sm text-muted-foreground">正在加载教程…</p>
      : !result.projects.length ? <p className="mt-3 text-sm text-muted-foreground">这个规格的站内教程正在整理。</p>
      : <>
        <ul className="mt-4 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.projects.map(item => <li key={item.project.id} className="min-w-0 border-b border-border/60">
            <Link href={`/project/${item.project.id}?kit=${encodeURIComponent(slug)}`} className="group flex min-h-12 items-center justify-between gap-3 rounded-sm py-3 text-sm hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span>{item.project.title}</span><ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" /></Link>
          </li>)}
        </ul>
      </>}
    {failed || result?.hasMore ? <Button variant="outline" className="mt-4" disabled={loading} onClick={() => { setLoading(true); setFailed(false); if (failed) setAttempt(value => value + 1); else setPage(value => value + 1) }}>{loading ? '正在加载…' : failed ? '重试' : '更多教程'}</Button> : null}
  </div>
}
