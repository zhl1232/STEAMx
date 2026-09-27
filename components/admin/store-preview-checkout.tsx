'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAINLAND_PROVINCES } from '@/lib/store/regions'

type Product = {
  id: string
  name: string
  priceCents?: number
  price_cents?: number
  shippingCents?: number
  shipping_cents?: number
  variants?: Array<{
    id: string
    name: string
    priceCents?: number | null
    price_cents?: number | null
    stockQuantity?: number | null
    stock_quantity?: number | null
  }>
}
const provinces = MAINLAND_PROVINCES

export function StorePreviewCheckout() {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [province, setProvince] = useState('北京市')
  const [address, setAddress] = useState({
    recipientName: '',
    phone: '',
    city: '',
    district: '',
    street: '',
    postalCode: '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [idempotencyKey] = useState(() => `preview-${crypto.randomUUID()}`)
  useEffect(() => {
    fetch('/api/admin/store/catalog')
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error || '商品目录加载失败')
        return body
      })
      .then((body) => {
        const list = body.products || []
        setProducts(list)
        if (list[0]) {
          setProductId(list[0].id)
          setVariantId(list[0].variants?.[0]?.id || '')
        }
      })
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : '商品目录加载失败'),
      )
  }, [])
  const product = products.find((item) => item.id === productId)
  const variant =
    product?.variants?.find((item) => item.id === variantId) ||
    product?.variants?.[0]
  const unit =
    variant?.priceCents ??
    variant?.price_cents ??
    product?.priceCents ??
    product?.price_cents ??
    0
  const shipping = product?.shippingCents ?? product?.shipping_cents ?? 0
  const total = unit * quantity + shipping
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
          address: { ...address, province },
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '下单失败')
      setOrderId(body.order?.id || null)
      setMessage('订单已创建，可打开订单详情继续支付。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '下单失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="mx-auto max-w-2xl rounded border bg-background p-5 shadow-sm">
      <h1 className="text-2xl font-bold">本站支付预览</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        仅限本地测试数据库，用于验证单 SKU、地址、运费和支付前流程。
      </p>
      <div className="mt-5 grid gap-3">
        <label className="text-sm font-medium">
          商品
          <select
            aria-label="商品"
            className="mt-1 h-10 w-full rounded border bg-background px-3"
            value={productId}
            onChange={(e) => {
              const next = products.find((item) => item.id === e.target.value)
              setProductId(e.target.value)
              setVariantId(next?.variants?.[0]?.id || '')
            }}
          >
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          规格
          <select
            aria-label="规格"
            className="mt-1 h-10 w-full rounded border bg-background px-3"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {product?.variants?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          数量
          <Input
            aria-label="数量"
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
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
            onChange={(e) => setAddress({ ...address, phone: e.target.value })}
          />
          <select
            aria-label="省份"
            className="h-10 rounded border bg-background px-3"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            {provinces.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <Input
            aria-label="城市"
            placeholder="城市"
            value={address.city}
            onChange={(e) => setAddress({ ...address, city: e.target.value })}
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
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
          />
        </div>
        <div className="rounded bg-muted p-3 text-sm">
          商品 ¥{((unit * quantity) / 100).toFixed(2)} + 运费 ¥
          {(shipping / 100).toFixed(2)} ={' '}
          <strong>¥{(total / 100).toFixed(2)}</strong>
        </div>
        <Button
          disabled={
            busy ||
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
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          创建测试订单
        </Button>
        {message ? (
          <p className="text-sm text-muted-foreground">
            {message}{' '}
            {orderId ? (
              <a
                className="text-primary underline"
                href={`/store/orders/${orderId}`}
              >
                查看订单
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </section>
  )
}
