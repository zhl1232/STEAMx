'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppWideShell } from '@/components/layout/app-shell'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAINLAND_PROVINCES } from '@/lib/store/regions'
import { money, storeJson, type StoreProduct } from './store-catalog-client'

type Quote = { originalSubtotalCents: number; memberSubtotalCents: number; memberDiscountCents: number; membershipTier: 'free' | 'pro' | 'founder'; shippingCents: number; couponDiscountCents: number; coinDiscountCents: number; coinsUsed: number; totalCents: number; couponId: string | null }
type Coupon = { id: string; title: string; threshold_cents: number; discount_cents: number; expires_at: string; eligible: boolean; eligible_product_ids: string[] }
export function StoreQuoteBreakdown({ quote }: { quote: Quote }) {
  return <dl className="space-y-3 text-sm">{[
    ['商品原价', money(quote.originalSubtotalCents)],
    ['会员优惠', `−${money(quote.memberDiscountCents)}`],
    ['会员折后商品金额', money(quote.memberSubtotalCents)],
    ['优惠券', `−${money(quote.couponDiscountCents)}`],
    [`硬币抵扣（${quote.coinsUsed} 枚）`, `−${money(quote.coinDiscountCents)}`],
    ['运费（不参与优惠）', money(quote.shippingCents)],
  ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}<div className="flex justify-between border-t pt-4 text-lg font-semibold"><dt>应付合计</dt><dd>{money(quote.totalCents)}</dd></div></dl>
}
type IntentRecord = { key: string; orderId?: string; pending?: { province: string; discount: string } }
export function StoreCheckout({ userId, productId, variantId, quantity, intentId = '' }: { userId: string; productId: string; variantId: string; quantity: number; intentId?: string }) {
  const [product, setProduct] = useState<StoreProduct | null>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [discount, setDiscount] = useState('none')
  const [province, setProvince] = useState('北京市')
  const [address, setAddress] = useState({ recipientName: '', phone: '', city: '', district: '', street: '' })
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [ready, setReady] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupFailed, setLookupFailed] = useState(false)
  const record = useRef<IntentRecord | null>(null)
  const originalRequest = useRef<string | null>(null)
  const requestLock = useRef(false)
  const resetBenefitsOnLookup = useRef(false)
  const [reconfirm, setReconfirm] = useState(0)
  const storageKey = `store-intent-v2:${userId}:${productId}:${variantId}:${quantity}:${intentId}`
  const persist = useCallback((next: IntentRecord) => {
    // Persist only identifiers and discount/province selection, never a recipient or address.
    sessionStorage.setItem(storageKey, JSON.stringify(next))
    record.current = next
  }, [storageKey])
  const recoverIntent = useCallback(async (allowBenefitChange = false) => {
    if (!record.current) return
    if (allowBenefitChange) resetBenefitsOnLookup.current = true
    setReady(false); setLookupBusy(true); setLookupFailed(false); setError('')
    try {
      const body = await storeJson<{ order: { id: string } | null }>(`/api/store/orders?intent=${encodeURIComponent(record.current.key)}`, { cache: 'no-store' })
      if (body.order?.id) {
        persist({ key: record.current.key, orderId: body.order.id })
        setOrderId(body.order.id)
        resetBenefitsOnLookup.current = false
      } else if (resetBenefitsOnLookup.current) {
        persist({ key: record.current.key })
        originalRequest.current = null
        setAttempted(false); setRecovering(false); setDiscount('none'); setQuote(null)
        setReconfirm(value => value + 1)
        resetBenefitsOnLookup.current = false
        setError('尚未查到订单，可以重新选择优惠。请核对最新金额后再确认。')
      } else {
        setRecovering(true)
        setError('尚未查到订单。请重新填写原收货信息，继续确认同一笔购买。')
      }
      setReady(true)
    } catch (cause) {
      setLookupFailed(true)
      setError(cause instanceof Error ? cause.message : '暂时无法核查订单，请重试。')
    } finally { setLookupBusy(false) }
  }, [persist])
  useEffect(() => {
    let active = true
    async function initialize() {
      try {
        const stored = sessionStorage.getItem(storageKey)
        const intent: IntentRecord = stored ? JSON.parse(stored) : { key: `web-${intentId || crypto.randomUUID()}` }
        if (!intent.key || typeof intent.key !== 'string') throw new Error('购买记录无法读取，请先查看我的订单。')
        persist(intent)
        if (intent.orderId) { setOrderId(intent.orderId); setReady(true) }
        else if (intent.pending) {
          setProvince(intent.pending.province); setDiscount(intent.pending.discount)
          await recoverIntent()
        } else setReady(true)
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : '购买记录无法读取，请先查看我的订单。') }
    }
    void initialize()
    void storeJson<{ products: StoreProduct[] }>(`/api/store/products?product=${encodeURIComponent(productId)}`).then(body => { if (active) { setProduct(body.products.find(p => p.id === productId) || null); if (!body.products.some(p => p.id === productId)) setError('该商品暂不可用，请返回商品页。') } }).catch(e => { if (active) setError(e.message) })
    void storeJson<{ coupons: Coupon[] }>('/api/store/coupons').then(body => { if (active) setCoupons(body.coupons) }).catch(() => { /* Unavailable coupons never select or spend a discount. */ })
    return () => { active = false }
  }, [productId, storageKey, intentId, persist, recoverIntent])
  useEffect(() => {
    if (!ready || orderId || attempted) return
    const controller = new AbortController()
    let active = true
    // eslint-disable-next-line react/set-state-in-effect -- Invalidate the previous network quote before requesting the new one.
    setQuote(null)
    setLoadingQuote(true)
    void storeJson<{ quote: Quote }>('/api/store/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ items: [{ variantId, quantity }], province, couponId: discount.startsWith('coupon:') ? discount.slice(7) : null, useCoins: discount === 'coins' }) }).then(body => { if (active) setQuote(body.quote) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoadingQuote(false) })
    return () => { active = false; controller.abort() }
  }, [variantId, quantity, province, discount, reconfirm, ready, orderId, attempted])
  const variant = product?.variants.find(v => v.id === variantId)
  const validQuantity = variant && Number.isInteger(quantity) && quantity >= variant.min_quantity && quantity <= Math.min(100, variant.stock_quantity)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if ((!quote && !originalRequest.current) || requestLock.current || !record.current || !ready) return
    requestLock.current = true
    setBusy(true); setError('')
    try {
      const request = originalRequest.current || JSON.stringify({ items: [{ variantId, quantity }], address: { ...address, province, postalCode: '' }, expectedQuote: quote, couponId: discount.startsWith('coupon:') ? discount.slice(7) : null, useCoins: discount === 'coins' })
      persist({ key: record.current.key, pending: { province, discount } })
      originalRequest.current = request
      setAttempted(true)
      const response = await fetch('/api/store/orders', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': record.current.key }, body: request })
      // A definitive validation response can be corrected. An unreadable success or
      // a network/5xx failure remains uncertain and retains the original request.
      if (response.status === 400 || response.status === 422 || response.status === 409) {
        const body = await response.json().catch(() => ({}))
        if (response.status !== 409 || body.code === 'QUOTE_CHANGED') {
          originalRequest.current = null
          persist({ key: record.current.key })
          setAttempted(false); setRecovering(false)
          if (body.code === 'QUOTE_CHANGED') {
            setQuote(null); setReconfirm(v => v + 1)
            setError('报价已变化，已重新获取。请核对最新金额后再次确认下单。')
          } else setError(body.error || '请检查收货信息后重新确认。')
          return
        }
        throw new Error(body.error || '订单结果尚未确认，请先核查我的订单。')
      }
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '订单结果尚未确认，请重试核查同一笔订单。')
      if (!body.order?.id) throw new Error('订单结果尚未确认，请重试核查同一笔订单。')
      persist({ key: record.current.key, orderId: body.order.id })
      setOrderId(body.order.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '连接中断，请重试核查同一笔订单。') }
    finally { setBusy(false); requestLock.current = false }
  }
  return <main><AppWideShell className="pb-24 pt-8"><Button asChild variant="ghost" className="h-11"><Link href={`/store/products/${productId}`}>← 返回商品</Link></Button><h1 className="mt-6 text-page-title">确认订单</h1><p className="mt-3 text-sm text-muted-foreground">一次购买一种规格。请核对收货信息和优惠后再下单。</p>
    <form onSubmit={submit} className="mt-8 grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6"><Surface className="p-6"><h2 className="text-panel-title">购买商品</h2><p className="mt-4 font-semibold">{product?.name || '正在加载商品…'}</p><p className="mt-2 text-sm text-muted-foreground">{variant?.name} × {quantity}</p>{product && !validQuantity ? <p role="alert" className="mt-3 text-destructive">该规格或数量暂不可购，请返回商品页重新选择。</p> : null}<p className="mt-4 text-sm leading-6 text-muted-foreground">{product?.fulfillment_description}</p></Surface>
      <Surface className="p-6"><h2 className="text-panel-title">收货信息</h2><fieldset disabled={!ready || attempted || busy || Boolean(orderId)} className="mt-5 grid gap-4 sm:grid-cols-2">{(['recipientName', 'phone'] as const).map((field, i) => <label key={field} className="grid gap-2 text-sm">{['收货人', '手机号'][i]}<Input required autoComplete={field === 'phone' ? 'tel' : 'name'} type={field === 'phone' ? 'tel' : 'text'} value={address[field]} onChange={e => setAddress({ ...address, [field]: e.target.value })} /></label>)}<label className="grid gap-2 text-sm">省份<select disabled={recovering} className="control-field h-11" value={province} onChange={e => { setQuote(null); setProvince(e.target.value) }}>{MAINLAND_PROVINCES.map(p => <option key={p}>{p}</option>)}</select></label>{(['city', 'district', 'street'] as const).map((field, i) => <label key={field} className={`grid gap-2 text-sm ${field === 'street' ? 'sm:col-span-2' : ''}`}>{['城市', '区县', '详细地址'][i]}<Input required autoComplete={field === 'street' ? 'street-address' : 'off'} value={address[field]} onChange={e => setAddress({ ...address, [field]: e.target.value })} /></label>)}</fieldset></Surface>
      <Surface className="p-6"><h2 className="text-panel-title">选择优惠</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">有效会员商品自动享 Pro 会员 8.8 折 / 创始会员 8 折，到期恢复原价。硬币每枚抵 1 分，最多抵会员折后商品金额的 10%；硬币与一张优惠券二选一，运费不参与优惠。</p><fieldset disabled={!ready || attempted || recovering || busy || Boolean(orderId)} className="mt-5 space-y-3"><legend className="sr-only">优惠方式</legend>{[{ id: 'none', title: '不使用硬币或优惠券' }, { id: 'coins', title: '使用硬币抵扣' }, ...coupons.filter(c => c.eligible && c.eligible_product_ids?.includes(productId)).map(c => ({ id: `coupon:${c.id}`, title: `${c.title} · 满${money(c.threshold_cents)}减${money(c.discount_cents)} · ${new Date(c.expires_at).toLocaleDateString('zh-CN')}到期` }))].map(option => <label key={option.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="discount" value={option.id} checked={discount === option.id} onChange={() => { setQuote(null); setError(''); setDiscount(option.id) }} />{option.title}</label>)}</fieldset></Surface></div>
      <Surface className="p-6 lg:sticky lg:top-24"><h2 className="mb-6 text-panel-title">订单金额</h2>{quote ? <StoreQuoteBreakdown quote={quote} /> : <p role="status" className="text-sm text-muted-foreground">{!ready ? (lookupBusy ? '正在核查上次购买结果…' : '正在恢复购买记录…') : orderId ? '请在订单详情查看已确认金额。' : loadingQuote ? '正在获取最新报价…' : '报价暂不可用，请重新获取。'}</p>}{ready && !orderId && !quote && !loadingQuote && !attempted ? <Button type="button" variant="outline" className="mt-4 h-11" onClick={() => { setError(''); setReconfirm(v => v + 1) }}>重新获取报价</Button> : null}{recovering && !attempted && !orderId ? <Button type="button" variant="outline" className="mt-4 h-11" disabled={lookupBusy} onClick={() => void recoverIntent(true)}>重新核查并选择优惠</Button> : null}{lookupFailed ? <Button type="button" variant="outline" className="mt-4 h-11" disabled={lookupBusy} onClick={() => void recoverIntent()}>重试核查购买结果</Button> : null}{error ? <p role="alert" className="mt-5 text-sm leading-6 text-destructive">{error}</p> : null}{attempted && !orderId ? <p className="mt-4 text-sm text-muted-foreground">信息已锁定。网络超时后重试会核查同一笔订单，也可先前往我的订单查看。</p> : null}{orderId ? <div role="status" className="mt-5"><p>订单已创建，请进入订单继续支付。</p><Button asChild tone="brand" shape="pill" className="mt-4 h-12 w-full"><Link href={`/store/orders/${orderId}`}>查看订单并支付</Link></Button></div> : <Button type="submit" tone="brand" shape="pill" className="mt-6 h-12 w-full" disabled={busy || !ready || (!attempted && (!quote || loadingQuote || !validQuantity))}>{busy ? '正在确认订单…' : attempted ? '重试核查同一笔订单' : '确认金额并创建订单'}</Button>}<Button asChild variant="ghost" className="mt-3 h-11 w-full"><Link href="/store/orders">查看我的订单</Link></Button></Surface>
    </form>
  </AppWideShell></main>
}
