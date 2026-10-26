'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Surface } from '@/components/ui/surface'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { MAINLAND_PROVINCES } from '@/lib/store/regions'

type Variant = {
  version?: number
  id?: string
  name: string
  sku: string
  priceCents: number | null
  stockQuantity: number
  minQuantity: number
  status: string
  supplierUrl: string
  costCents: number | null
}
type Product = {
  version?: number
  id?: string
  slug: string
  name: string
  description: string
  coverUrl: string
  priceCents: number
  shippingCents: number | null
  galleryUrls?: string[]
  detailContent?: string
  videoUrl?: string
  category?: string
  status: string
  fulfillmentDescription: string
  contextKeys: string[]
  blockedProvinces: string[]
  variants: Variant[]
}
type Order = {
  id: string
  status: string
  total_cents: number
  items: Array<{ title_snapshot: string; quantity: number }>
  procurement: {
    external_reference: string
    metadata: { cost_cents?: number; notes?: string }
  } | null
  shipment: { carrier: string; tracking_number: string } | null
  aftersale: {
    status: string
    reason: string
    carrier?: string
    tracking_number?: string
  } | null
}
type OrderPage = {
  orders: Order[]
  page: number
  pageSize: number
  hasMore: boolean
}
const newVariant = (): Variant => ({
  name: '默认规格',
  sku: '',
  priceCents: null,
  stockQuantity: 0,
  minQuantity: 1,
  status: 'active',
  supplierUrl: '',
  costCents: null,
})
const newProduct = (): Product => ({
  slug: '',
  name: '',
  description: '',
  coverUrl: '',
  priceCents: 100,
  shippingCents: null,
  galleryUrls: [],
  detailContent: '',
  videoUrl: '',
  category: '',
  status: 'draft',
  fulfillmentDescription: '',
  contextKeys: [],
  blockedProvinces: [],
  variants: [newVariant()],
})
const states: Record<string, string> = {
  pending_payment: '待付款',
  paid: '待采购',
  sourcing: '采购中',
  ordered: '待发货',
  shipped: '已发货',
  delivered: '已收货',
  cancelled: '已取消',
  refund_pending: '售后处理中',
  refunded: '已退款',
  failed: '需核查',
}
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '操作失败，请稍后重试')
  return body
}
function Field({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {title}
      {children}
    </label>
  )
}

export function StoreNativeOperations() {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderPage, setOrderPage] = useState(1)
  const [ordersHaveMore, setOrdersHaveMore] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [draft, setDraft] = useState(newProduct)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [review, setReview] = useState(false)
  const [focusedOrder, setFocusedOrder] = useState('')
  async function load(page = orderPage, selectRequestedProduct = false) {
    setOrdersLoading(true)
    try {
      const requestedOrder = new URLSearchParams(window.location.search).get('order') || ''
      if (requestedOrder && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedOrder)) throw new Error('订单编号格式无效')
      const [catalog, list] = await Promise.all([
        json<{ products: Product[] }>('/api/admin/store/catalog'),
        json<OrderPage>(requestedOrder ? `/api/admin/store/orders?order=${encodeURIComponent(requestedOrder)}&page=1` : `/api/admin/store/orders?page=${page}`),
      ])
      setProducts(catalog.products)
      if (selectRequestedProduct) {
        const requestedProduct = new URLSearchParams(window.location.search).get('product')
        const product = catalog.products.find(item => item.id === requestedProduct)
        if (product) setDraft({ ...product, description: product.description || '', coverUrl: product.coverUrl || '', fulfillmentDescription: product.fulfillmentDescription || '' })
      }
      setOrders(list.orders)
      setFocusedOrder(requestedOrder)
      setOrderPage(list.page)
      setOrdersHaveMore(list.hasMore)
    } finally {
      setOrdersLoading(false)
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- State changes only after the API request resolves.
    void load(1, true).catch((error) => setMessage(error.message))
  }, [])
  function variant(index: number, patch: Partial<Variant>) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((value, i) =>
        i === index ? { ...value, ...patch } : value,
      ),
    }))
  }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await json(
        draft.id
          ? `/api/admin/store/catalog/${draft.id}`
          : '/api/admin/store/catalog',
        {
          method: draft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        },
      )
      await load()
      setMessage('商品已保存')
      setDraft(newProduct())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-2xl border bg-background p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-primary">
              商品准备
            </p>
            <h2 className="mt-1 text-xl font-bold">材料包与可售规格</h2>
          </div>
          <Button variant="outline" onClick={() => setDraft(newProduct())}>
            新增商品
          </Button>
        </div>
        <div className="grid gap-7 lg:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有商品。</p>
            ) : (
              products.map((product) => (
                <div key={product.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...product,
                      description: product.description || '',
                      coverUrl: product.coverUrl || '',
                      fulfillmentDescription:
                        product.fulfillmentDescription || '',
                    })
                  }
                  className={`w-full rounded-lg border p-3 text-left text-sm ${draft.id === product.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <strong className="block">{product.name}</strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {product.status === 'active'
                      ? '已上架'
                      : product.status === 'archived'
                        ? '已归档'
                        : '草稿'}{' '}
                    · ¥{(product.priceCents / 100).toFixed(2)}
                  </span>
                </button>
                <Button asChild variant="ghost" size="sm" className="w-full justify-start text-xs">
                  <Link href={`/admin/store/products/${product.id}/preview`}>查看商品页面</Link>
                </Button>
                </div>
              ))
            )}
          </div>
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="商品名称">
                <Input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field title="英文标识">
                <Input
                  required
                  pattern="[a-z0-9][a-z0-9-]*"
                  placeholder="building-kit"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                />
              </Field>
              <Field title="售价（分）">
                <Input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={draft.priceCents}
                  onChange={(e) =>
                    setDraft({ ...draft, priceCents: Number(e.target.value) })
                  }
                />
              </Field>
              <Field title="每单运费（分，包邮填 0）">
                <Input
                  required={draft.status === 'active'}
                  type="number"
                  min={0}
                  step={1}
                  value={draft.shippingCents ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      shippingCents: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field title="封面图片地址（HTTPS 或站内资源）">
                <Input
                  value={draft.coverUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, coverUrl: e.target.value })
                  }
                />
              </Field>
              <Field title="商品状态">
                <select
                  className="h-10 rounded-md border bg-background px-3"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                >
                  <option value="draft">草稿</option>
                  <option value="active">上架（受商城开关限制）</option>
                  <option value="archived">归档</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="商品分类"><Input value={draft.category || ''} onChange={e => setDraft({ ...draft, category: e.target.value })} /></Field>
              <Field title="商品视频地址（可选）"><Input value={draft.videoUrl || ''} onChange={e => setDraft({ ...draft, videoUrl: e.target.value })} /></Field>
            </div>
            <Field title="商品相册（每行一个 HTTPS 或站内资源地址）"><textarea className="control-field min-h-24 p-3" value={(draft.galleryUrls || []).join('\n')} onChange={e => setDraft({ ...draft, galleryUrls: e.target.value.split('\n').filter(Boolean) })} /></Field>
            <Field title="商品详情（公开文字）"><textarea className="control-field min-h-32 p-3" value={draft.detailContent || ''} onChange={e => setDraft({ ...draft, detailContent: e.target.value })} /></Field>
            <Field title="商品说明">
              <textarea
                className="min-h-24 rounded-md border bg-background p-3"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </Field>
            <Field title="发货和履约说明">
              <Input
                required={draft.status === 'active'}
                placeholder="填写已确认的发货时效、配送及履约安排"
                value={draft.fulfillmentDescription}
                onChange={(e) =>
                  setDraft({ ...draft, fulfillmentDescription: e.target.value })
                }
              />
            </Field>
            <Field title="关联课程 / 课时 / 项目">
              <Input
                placeholder="course:1, lesson:2, project:3"
                value={draft.contextKeys.join(',')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    contextKeys: e.target.value
                      .split(/[,，\s]+/)
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                不配送地区（已选 {draft.blockedProvinces.length}）
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MAINLAND_PROVINCES.map((province) => (
                  <label
                    key={province}
                    className="flex items-center gap-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={draft.blockedProvinces.includes(province)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          blockedProvinces: e.target.checked
                            ? [...draft.blockedProvinces, province]
                            : draft.blockedProvinces.filter(
                                (value) => value !== province,
                              ),
                        })
                      }
                    />
                    {province}
                  </label>
                ))}
              </div>
            </details>
            {draft.variants.map((value, index) => (
              <fieldset
                key={value.id || index}
                className="rounded-xl border bg-muted/20 p-4"
              >
                <legend className="px-2 text-sm font-semibold">
                  规格 {index + 1}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field title="规格名称">
                    <Input
                      required
                      value={value.name}
                      onChange={(e) => variant(index, { name: e.target.value })}
                    />
                  </Field>
                  <Field title="SKU">
                    <Input
                      required
                      value={value.sku}
                      onChange={(e) => variant(index, { sku: e.target.value })}
                    />
                  </Field>
                  <Field title="规格售价（分，留空用商品价）">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={value.priceCents ?? ''}
                      onChange={(e) =>
                        variant(index, {
                          priceCents:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field title="库存总量（含已预留，扣除已售出）">
                    <Input
                      required
                      type="number"
                      min={0}
                      step={1}
                      value={value.stockQuantity ?? 0}
                      onChange={(e) =>
                        variant(index, {
                          stockQuantity: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field title="起订数量">
                    <Input
                      required
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={value.minQuantity}
                      onChange={(e) =>
                        variant(index, { minQuantity: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field title="规格状态">
                    <select
                      className="h-10 rounded-md border bg-background px-3"
                      value={value.status || 'active'}
                      onChange={(e) =>
                        variant(index, { status: e.target.value })
                      }
                    >
                      <option value="active">可售</option>
                      <option value="paused">暂停</option>
                      <option value="archived">归档</option>
                    </select>
                  </Field>
                  <Field title="供货链接（仅管理员可见）">
                    <Input
                      type="url"
                      value={value.supplierUrl || ''}
                      onChange={(e) =>
                        variant(index, { supplierUrl: e.target.value })
                      }
                    />
                  </Field>
                  <Field title="参考采购成本（分，仅管理员可见）">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={value.costCents ?? ''}
                      onChange={(e) =>
                        variant(index, {
                          costCents:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
              </fieldset>
            ))}
            <p className="text-sm leading-6 text-muted-foreground">草稿允许暂缺运费、履约说明与供货资料。上架前请逐项确认售价、库存、运费、发货安排及每个可售规格的供货链接；服务端会再次检查。供货链接和采购成本只供管理员查看。</p>
            <Button type="button" variant="outline" onClick={() => setReview(!review)}>{review ? '收起商品审核' : '预览并审核商品资料'}</Button>
            {review ? <Surface variant="subtle" className="space-y-4 p-5"><h3 className="text-panel-title">{draft.name || '未命名商品'} · {draft.status === 'active' ? '申请上架' : '草稿'}</h3><p className="whitespace-pre-line text-sm">{draft.description}</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[draft.coverUrl, ...(draft.galleryUrls || [])].filter(Boolean).map((url, index) => <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-md"><OptimizedImage src={url} alt={`审核图片 ${index + 1}`} fill className="object-contain" /></div>)}</div><p className="whitespace-pre-line text-sm">{draft.detailContent}</p>{draft.videoUrl ? <video controls preload="none" className="w-full" src={draft.videoUrl}><track kind="captions" /></video> : null}<p className="text-sm">运费：{draft.shippingCents == null ? '待确认' : `¥${(draft.shippingCents / 100).toFixed(2)}`} · 履约：{draft.fulfillmentDescription || '待确认'}</p><p className="text-sm">规格 {draft.variants.length} 种 · 缺供货链接 {draft.variants.filter(v => !v.supplierUrl).length} 种</p></Surface> : null}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={draft.variants.length >= 50}
                onClick={() =>
                  setDraft({
                    ...draft,
                    variants: [...draft.variants, newVariant()],
                  })
                }
              >
                增加规格
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? '保存中…' : '保存商品'}
              </Button>
            </div>
          </form>
        </div>
      </section>
      <section className="rounded-2xl border bg-background p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">采购、发货与售后</h2>
            <Button
            variant="outline"
            disabled={ordersLoading}
            onClick={() =>
              void load().catch((error) => setMessage(error.message))
            }
          >
            刷新订单
          </Button>
        </div>
        {focusedOrder ? <p className="mt-4 break-all text-sm">正在查看指定订单 {focusedOrder} · <Button variant="ghost" size="sm" onClick={() => window.location.assign('/admin/store')}>返回全部订单</Button></p> : null}
        <div className="mt-5 space-y-4">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无本站订单。</p>
          ) : (
            orders.map((order) => (
              <OrderOperations
                key={order.id}
                order={order}
                reload={() => load(orderPage)}
              />
            ))
          )}
        </div>
        {(orderPage > 1 || ordersHaveMore) && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={ordersLoading || orderPage <= 1}
              onClick={() =>
                void load(orderPage - 1).catch((error) => setMessage(error.message))
              }
            >
              上一页
            </Button>
            <span className="text-sm text-muted-foreground">第 {orderPage} 页</span>
            <Button
              variant="outline"
              disabled={ordersLoading || !ordersHaveMore}
              onClick={() =>
                void load(orderPage + 1).catch((error) => setMessage(error.message))
              }
            >
              下一页
            </Button>
          </div>
        )}
      </section>
      {message && (
        <p
          role="status"
          className="rounded-lg border bg-background p-4 text-sm"
        >
          {message}
        </p>
      )}
    </div>
  )
}

function OrderOperations({
  order,
  reload,
}: {
  order: Order
  reload: () => Promise<void>
}) {
  const [action, setAction] = useState('')
  const [payload, setPayload] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [address, setAddress] = useState('')
  const [sourceSnapshot, setSourceSnapshot] = useState<{ variantName?: string; sku?: string; supplierUrl?: string; costCents?: number | null; createdAt?: string } | null>(null)
  const choices: Array<[string, string]> = []
  if (['paid', 'sourcing', 'ordered'].includes(order.status))
    choices.push(['record_procurement', '记录采购'])
  if (order.status === 'ordered') choices.push(['ship', '填写发货'])
  if (order.aftersale?.status === 'requested')
    choices.push(
      ['approve_refund', '同意整单退款'],
      ['require_return', '要求先退货'],
      ['reject_refund', '拒绝申请'],
    )
  if (order.aftersale?.status === 'returned')
    choices.push(['receive_return', '确认收到退货并退款'])
  if (order.aftersale?.status === 'refund_pending')
    choices.push(['retry_refund', '核查并重试退款'])
  const fields: Record<string, Array<[string, string]>> = {
    record_procurement: [
      ['reference', '采购单号'],
      ['costCents', '实际采购成本（分）'],
      ['notes', '采购备注'],
    ],
    ship: [
      ['carrier', '物流公司'],
      ['trackingNumber', '物流单号'],
    ],
    require_return: [['returnAddress', '完整退货收件人、电话和地址']],
    reject_refund: [['reason', '拒绝原因']],
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await json<{ message?: string }>(
        `/api/admin/store/orders/${order.id}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            ...(action === 'record_procurement'
              ? { costCents: Number(payload.costCents) }
              : {}),
            action,
          }),
        },
      )
      await reload()
      setAction('')
      setMessage(result.message || '操作已保存')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }
  async function showAddress() {
    try {
      const result = await json<{ address: Record<string, string>; procurementSnapshot?: { snapshot: { variantName?: string; sku?: string; supplierUrl?: string; costCents?: number | null }; created_at: string } | null }>(
        `/api/admin/store/orders/${order.id}`,
      )
      setSourceSnapshot(result.procurementSnapshot ? { ...result.procurementSnapshot.snapshot, createdAt: result.procurementSnapshot.created_at } : null)
      setAddress(
        ['recipientName', 'phone', 'province', 'city', 'district', 'street']
          .map((key) => result.address[key])
          .join(' '),
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '地址读取失败')
    }
  }
  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm">订单 {order.id.slice(0, 8)}</strong>
        <span className="text-sm">
          {states[order.status] || order.status} · ¥
          {(order.total_cents / 100).toFixed(2)}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {order.items
          .map((item) => `${item.title_snapshot} × ${item.quantity}`)
          .join('，')}
      </p>
      {order.procurement?.external_reference && (
        <p className="mt-2 text-sm">
          采购单：{order.procurement.external_reference} · 成本 ¥
          {((order.procurement.metadata.cost_cents || 0) / 100).toFixed(2)}
        </p>
      )}
      {order.shipment && (
        <p className="mt-2 text-sm">
          发货：{order.shipment.carrier} {order.shipment.tracking_number}
        </p>
      )}
      {order.aftersale && (
        <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
          <p>售后原因：{order.aftersale.reason}</p>
          {order.aftersale.tracking_number && (
            <p>
              退货：{order.aftersale.carrier} {order.aftersale.tracking_number}
            </p>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={showAddress}>
          查看收货地址
        </Button>
        {choices.map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setAction(key)
              setPayload({})
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {address && (
        <p className="mt-3 break-words rounded-lg bg-muted p-3 text-sm">
          {address}
        </p>
      )}
      {sourceSnapshot ? <Surface variant="subtle" className="mt-3 space-y-2 p-4 text-sm"><p className="font-semibold">下单时供货快照（仅管理员可见）</p><p>{sourceSnapshot.variantName} · {sourceSnapshot.sku}</p>{sourceSnapshot.supplierUrl ? <a href={sourceSnapshot.supplierUrl} target="_blank" rel="noreferrer" className="break-all text-primary underline">原供货链接</a> : <p>下单时未记录供货链接</p>}<p>参考采购成本：{sourceSnapshot.costCents == null ? '未记录' : `¥${(sourceSnapshot.costCents / 100).toFixed(2)}`}</p><p className="text-xs text-muted-foreground">商品资料后续编辑不会改写此快照。</p></Surface> : null}
      {action && (
        <form
          onSubmit={submit}
          className="mt-4 space-y-3 rounded-lg border p-4"
        >
          <p className="font-medium">
            {choices.find(([key]) => key === action)?.[1]}
          </p>
          {(fields[action] || []).map(([key, label]) => (
            <Field key={key} title={label}>
              <Input
                required={key !== 'notes'}
                type={key === 'costCents' ? 'number' : 'text'}
                min={key === 'costCents' ? 0 : undefined}
                step={1}
                value={payload[key] || ''}
                onChange={(event) =>
                  setPayload({ ...payload, [key]: event.target.value })
                }
              />
            </Field>
          ))}
          {['approve_refund', 'receive_return', 'retry_refund'].includes(
            action,
          ) && (
            <p className="text-sm text-muted-foreground">
              将按原支付渠道处理整单 ¥{(order.total_cents / 100).toFixed(2)}
              ，含运费。
            </p>
          )}
          <div className="flex gap-2">
            <Button disabled={busy} type="submit">
              {busy ? '处理中…' : '确认操作'}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setAction('')}
            >
              取消
            </Button>
          </div>
        </form>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </article>
  )
}
