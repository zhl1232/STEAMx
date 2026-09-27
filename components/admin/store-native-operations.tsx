'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  shippingCents: number
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
  shippingCents: 0,
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
  async function load(page = orderPage) {
    setOrdersLoading(true)
    try {
      const [catalog, list] = await Promise.all([
        json<{ products: Product[] }>('/api/admin/store/catalog'),
        json<OrderPage>(`/api/admin/store/orders?page=${page}`),
      ])
      setProducts(catalog.products)
      setOrders(list.orders)
      setOrderPage(list.page)
      setOrdersHaveMore(list.hasMore)
    } finally {
      setOrdersLoading(false)
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- State changes only after the API request resolves.
    void load().catch((error) => setMessage(error.message))
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
                <button
                  key={product.id}
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
                  required
                  type="number"
                  min={0}
                  step={1}
                  value={draft.shippingCents ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      shippingCents: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field title="封面图片 HTTPS 地址">
                <Input
                  type="url"
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
                required
                placeholder="例如：付款后 3 个工作日内由供应商发货"
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
      const result = await json<{ address: Record<string, string> }>(
        `/api/admin/store/orders/${order.id}`,
      )
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
