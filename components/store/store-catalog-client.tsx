'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2, PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { MAINLAND_PROVINCES } from '@/lib/store/regions'

type Product = {
  id: string
  name: string
  description?: string | null
  cover_url?: string | null
  fulfillment_description?: string | null
  blocked_provinces?: string[]
  priceCents?: number
  price_cents?: number
  shippingCents?: number
  shipping_cents?: number
  checkout_mode?: 'internal' | 'external'
  external_url?: string | null
  variants?: Array<{
    id: string
    name: string
    priceCents?: number | null
    price_cents?: number | null
    minQuantity?: number
    min_quantity?: number
    stock_quantity?: number
  }>
}
const provinces = MAINLAND_PROVINCES

export function StoreCatalogClient() {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [requestedProductId, setRequestedProductId] = useState<string | null>(null)
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [province, setProvince] = useState('北京市')
  const [address, setAddress] = useState({
    recipientName: '',
    phone: '',
    city: '',
    district: '',
    street: '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [idempotencyKey] = useState(() => `web-${crypto.randomUUID()}`)
  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get('product')
    fetch(requestedId ? `/api/store/products?product=${encodeURIComponent(requestedId)}` : '/api/store/products')
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error || '商品加载失败')
        return body
      })
      .then((body) => {
        const list = body.products || []
        setRequestedProductId(requestedId)
        setProducts(list)
        const selected = requestedId ? list.find((item: Product) => item.id === requestedId) : list[0]
        if (selected) {
          setProductId(selected.id)
          setVariantId(selected.variants?.[0]?.id || '')
        } else {
          setProductId('')
          setVariantId('')
          if (requestedId) setMessage('请求的商品暂不可用，请从商品列表中选择。')
        }
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : '商品加载失败'))
  }, [])
  const product = products.find((p) => p.id === productId)
  const requestedProductUnavailable = Boolean(requestedProductId && products.length > 0 && !product)
  const variant =
    product?.variants?.find((v) => v.id === variantId) || product?.variants?.[0]
  const unit =
    variant?.priceCents ??
    variant?.price_cents ??
    product?.priceCents ??
    product?.price_cents ??
    0
  const shipping = product?.shippingCents ?? product?.shipping_cents ?? 0
  const external = product?.checkout_mode === 'external'
  const submit = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/store/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          items: [{ variantId: variant?.id, quantity }],
          address: { ...address, province, postalCode: '' },
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '下单失败')
      setOrderId(body.order?.id || null)
      setMessage('订单已创建，可打开订单详情继续支付。')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '下单失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="min-h-screen bg-[hsl(var(--surface-sunken))] pb-16">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <PackageCheck className="h-5 w-5 text-primary" />
          材料包商城
        </div>
        <Link
          className="text-sm font-semibold text-primary"
          href="/store/orders"
        >
          本站订单
        </Link>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-5">
        <h1 className="text-3xl font-black">把灵感装进材料包</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          每次只选择一个规格下单，地址与支付信息只用于本站订单。
        </p>
        {message && !products.length ? (
          <p
            role="alert"
            className="mt-5 rounded border border-destructive/30 p-4 text-sm text-destructive"
          >
            {message}
          </p>
        ) : null}
        <section className="mt-6 max-w-xl rounded-xl border bg-background p-5 shadow-sm">
          {requestedProductUnavailable ? (
            <p role="alert" className="mb-4 rounded border border-destructive/30 p-3 text-sm text-destructive">
              请求的商品暂不可用，请从商品列表中选择。
            </p>
          ) : null}
          <label className="text-sm font-medium">
            商品
            <select
              aria-label="商品"
              className="mt-1 h-10 w-full rounded border bg-background px-3"
              value={productId}
              onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value)
                setProductId(e.target.value)
                setVariantId(p?.variants?.[0]?.id || '')
              }}
            >
              {productId === '' ? <option value="">请选择商品</option> : null}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {product?.cover_url && <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-lg"><OptimizedImage src={product.cover_url} alt={product.name} fill variant="thumbnail" className="object-contain" /></div>}
          {product?.fulfillment_description && <p className="mt-3 text-sm text-muted-foreground">{product.fulfillment_description}</p>}
          {product?.description ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {product.description}
            </p>
          ) : null}
          {external && product.external_url ? (
            <a
              className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
              href={product.external_url}
              target="_blank"
              rel="noreferrer"
            >
              去淘宝购买
            </a>
          ) : (
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-medium">
                规格
                <select
                  aria-label="规格"
                  className="mt-1 h-10 w-full rounded border bg-background px-3"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                >
                  {product?.variants?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                数量
                <Input
                  aria-label="数量"
                  type="number"
                  min={variant?.minQuantity ?? variant?.min_quantity ?? 1}
                  max={100}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value)))
                  }
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  aria-label="收货人"
                  placeholder="收货人"
                  value={address.recipientName}
                  onChange={(e) =>
                    setAddress({ ...address, recipientName: e.target.value })
                  }
                />
                <Input
                  aria-label="手机号"
                  placeholder="手机号"
                  value={address.phone}
                  onChange={(e) =>
                    setAddress({ ...address, phone: e.target.value })
                  }
                />
                <select
                  aria-label="省份"
                  className="h-10 rounded border bg-background px-3"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                >
                  {provinces.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <Input
                  aria-label="城市"
                  placeholder="城市"
                  value={address.city}
                  onChange={(e) =>
                    setAddress({ ...address, city: e.target.value })
                  }
                />
                <Input
                  aria-label="区县"
                  placeholder="区县"
                  value={address.district}
                  onChange={(e) =>
                    setAddress({ ...address, district: e.target.value })
                  }
                />
                <Input
                  aria-label="详细地址"
                  className="sm:col-span-2"
                  placeholder="详细地址"
                  value={address.street}
                  onChange={(e) =>
                    setAddress({ ...address, street: e.target.value })
                  }
                />
              </div>
              <p className="rounded bg-muted p-3 text-sm">
                合计 ¥{((unit * quantity + shipping) / 100).toFixed(2)}（含运费 ¥{(shipping / 100).toFixed(2)}）
              </p>
              <Button
                disabled={
                  busy ||
                  !Number.isInteger(quantity) ||
                  quantity < (variant?.minQuantity ?? variant?.min_quantity ?? 1) ||
                  quantity > (variant?.stock_quantity ?? 100) ||
                  quantity > 100 ||
                  Boolean(product?.blocked_provinces?.includes(province)) ||
                  Boolean(orderId) ||
                  !variant ||
                  !address.recipientName ||
                  !address.phone ||
                  !address.city ||
                  !address.district ||
                  !address.street
                }
                onClick={submit}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                创建本站订单
              </Button>
              {message ? (
                <p className="text-sm text-muted-foreground">
                  {message}{' '}
                  {orderId ? (
                    <Link
                      className="text-primary underline"
                      href={`/store/orders/${orderId}`}
                    >
                      查看订单
                    </Link>
                  ) : null}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
