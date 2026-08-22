'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { ArrowRight, Box, Loader2, PackageCheck, ShoppingBag, Truck } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { MobileGlobalHeader } from '@/components/layout/mobile-global-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Variant = {
  id: string
  name: string
  sku: string
  price_cents: number | null
  min_quantity: number
  stock_quantity: number | null
}
type Product = {
  id: string
  slug: string
  name: string
  description: string | null
  cover_url: string | null
  price_cents: number
  variants: Variant[]
}
type Address = { recipientName: string; phone: string; province: string; city: string; district: string; street: string; postalCode: string }

const emptyAddress: Address = { recipientName: '', phone: '', province: '', city: '', district: '', street: '', postalCode: '' }

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || '请求失败')
  return body as T
}

export default function StorePage() {
  const [cart, setCart] = useState<Record<string, number>>({})
  const [address, setAddress] = useState(emptyAddress)
  const [message, setMessage] = useState<string | null>(null)
  const products = useQuery({
    queryKey: ['store-products'],
    queryFn: () => readJson<{ products: Product[] }>('/api/store/products'),
  })
  const createOrder = useMutation({
    mutationFn: () => readJson<{ order: { id: string; total_cents: number } }>('/api/store/orders', {
      method: 'POST',
      headers: { 'idempotency-key': `web-${crypto.randomUUID()}` },
      body: JSON.stringify({
        items: Object.entries(cart).map(([variantId, quantity]) => ({ variantId, quantity })),
        address,
      }),
    }),
    onSuccess: ({ order }) => {
      setMessage(`订单已创建（${order.id.slice(0, 8)}），支付通道待配置。`)
      setCart({})
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : '订单创建失败'),
  })

  const selectedLines = useMemo(() => {
    const all = products.data?.products || []
    return all.flatMap((product) => product.variants.flatMap((variant) => {
      const quantity = cart[variant.id] || 0
      return quantity ? [{ product, variant, quantity }] : []
    }))
  }, [cart, products.data])
  const totalCents = selectedLines.reduce((sum, line) => sum + (line.variant.price_cents ?? line.product.price_cents) * line.quantity, 0)

  const setQuantity = (variantId: string, quantity: number) => {
    setCart((current) => {
      const next = { ...current }
      if (quantity <= 0) delete next[variantId]
      else next[variantId] = Math.min(100, Math.floor(quantity))
      return next
    })
  }

  return (
    <main className="min-h-screen bg-[hsl(var(--surface-sunken))] pb-16">
      <MobileGlobalHeader variant="title" title="材料包商城" rightSlot={<Link className="text-sm font-semibold text-primary" href="/store/orders">我的订单</Link>} />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 rounded-2xl border border-border/70 bg-background p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><PackageCheck className="h-3.5 w-3.5" /> 实物商城</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">把灵感装进材料包</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">本站收款后，由已开通代发的供应商直接寄给家长。商品与金币商店分开，地址仅以加密快照保存。</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><Truck className="h-5 w-5 text-primary" /> 供应商代发直寄</div>
        </div>

        {products.isPending ? <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 正在加载商品…</div> : null}
        {products.error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">商品暂时无法加载，请稍后刷新。</div> : null}
        {!products.isPending && !products.error && !products.data?.products.length ? <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">商品正在准备中，稍后再来看看。</div> : null}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {(products.data?.products || []).map((product) => (
            <article key={product.id} className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
              <div className="relative aspect-[16/10] bg-muted">
                {product.cover_url ? <Image src={product.cover_url} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><Box className="h-10 w-10" /></div>}
              </div>
              <div className="p-5">
                <h2 className="font-bold">{product.name}</h2>
                <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{product.description || '适合课程项目的精选材料包。'}</p>
                {product.variants.length ? product.variants.map((variant) => (
                  <div key={variant.id} className="mt-4 rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{variant.name}</span><span className="font-bold text-primary">¥{((variant.price_cents ?? product.price_cents) / 100).toFixed(2)}</span></div>
                    <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">起订 {variant.min_quantity} 件</span><Input aria-label={`${variant.name}数量`} type="number" min={0} max={100} value={cart[variant.id] || 0} onChange={(event) => setQuantity(variant.id, Number(event.target.value))} className="h-9 w-24 text-center" /></div>
                  </div>
                )) : <p className="mt-4 text-xs text-muted-foreground">规格同步中</p>}
              </div>
            </article>
          ))}
        </div>

        <section className="mt-8 grid gap-6 rounded-2xl border border-border/70 bg-background p-5 shadow-sm lg:grid-cols-[1fr_360px] lg:p-7">
          <div>
            <div className="mb-4 flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">收货信息</h2></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([['recipientName', '收货人'], ['phone', '手机号'], ['province', '省份'], ['city', '城市'], ['district', '区县'], ['postalCode', '邮编（可选）']] as const).map(([key, label]) => <Input key={key} placeholder={label} value={address[key]} onChange={(event) => setAddress((current) => ({ ...current, [key]: event.target.value }))} />)}
              <Input className="sm:col-span-2" placeholder="详细地址" value={address.street} onChange={(event) => setAddress((current) => ({ ...current, street: event.target.value }))} />
            </div>
          </div>
          <div className="rounded-xl bg-muted/50 p-5"><p className="text-sm text-muted-foreground">本次订单</p><p className="mt-2 text-3xl font-black">¥{(totalCents / 100).toFixed(2)}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">运费暂按 ¥0 计，最终以供应商和物流规则为准。支付通道接入后会在此处完成支付。</p><Button className="mt-5 w-full" tone="brand" disabled={!selectedLines.length || createOrder.isPending} onClick={() => { setMessage(null); createOrder.mutate() }}>{createOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}创建待支付订单</Button>{message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}</div>
        </section>
      </div>
    </main>
  )
}
