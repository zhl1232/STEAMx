'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppWideShell } from '@/components/layout/app-shell'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Package, MapPin, Tag, CreditCard } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { StoreCheckoutPayment } from './store-checkout-payment'
import { MAINLAND_PROVINCES } from '@/lib/store/regions'
import { money, storeJson, type StoreProduct } from './store-catalog-client'

type Quote = { originalSubtotalCents: number; memberSubtotalCents: number; memberDiscountCents: number; membershipTier: 'free' | 'pro' | 'founder'; shippingCents: number; couponDiscountCents: number; coinDiscountCents: number; coinsUsed: number; totalCents: number; couponId: string | null }
type Coupon = { id: string; title: string; threshold_cents: number; discount_cents: number; expires_at: string; eligible: boolean; eligible_product_ids: string[] }
export function StoreQuoteBreakdown({ quote }: { quote: Quote }) {
  const rows = [
    ['商品金额', money(quote.originalSubtotalCents)],
    ...(quote.memberDiscountCents > 0 ? [['会员优惠', `−${money(quote.memberDiscountCents)}`]] : []),
    ...(quote.couponDiscountCents > 0 ? [['优惠券', `−${money(quote.couponDiscountCents)}`]] : []),
    ...(quote.coinDiscountCents > 0 ? [[`硬币抵扣（${quote.coinsUsed} 枚）`, `−${money(quote.coinDiscountCents)}`]] : []),
    ['运费', quote.shippingCents === 0 ? '免运费' : money(quote.shippingCents)],
  ]
  return <dl className="space-y-3 text-sm">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className={`shrink-0 tabular-nums ${value.startsWith('−') ? 'font-medium text-primary' : ''}`}>{value}</dd></div>)}<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-5"><dt className="font-semibold">实付金额</dt><dd className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{money(quote.totalCents)}</dd></div></dl>
}
type IntentRecord = { key: string; orderId?: string; pending?: { province: string; discount: string } }
export function StoreCheckout({ userId, productId, variantId, quantity, intentId = '', paymentProviders = [] }: { userId: string; productId: string; variantId: string; quantity: number; intentId?: string; paymentProviders?: Array<'alipay' | 'wechat'> }) {
  const [provider, setProvider] = useState<'alipay' | 'wechat' | undefined>(paymentProviders[0])
  const [autoPay, setAutoPay] = useState(false)
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
      } else if (record.current.pending?.discount === 'coins') {
        persist({ key: record.current.key })
        originalRequest.current = null
        setAttempted(false); setRecovering(false); setDiscount('none'); setQuote(null)
        setReconfirm(value => value + 1)
        resetBenefitsOnLookup.current = false
        setError('尚未查到原订单。硬币抵扣已调整为兑换优惠券，请重新选择优惠并核对最新金额后确认下单。')
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
    void storeJson<{ quote: Quote }>('/api/store/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ items: [{ variantId, quantity }], province, couponId: discount.startsWith('coupon:') ? discount.slice(7) : null, useCoins: false }) }).then(body => { if (active) setQuote(body.quote) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoadingQuote(false) })
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
      const request = originalRequest.current || JSON.stringify({ items: [{ variantId, quantity }], address: { ...address, province, postalCode: '' }, expectedQuote: quote, couponId: discount.startsWith('coupon:') ? discount.slice(7) : null, useCoins: false })
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
      setAutoPay(true)
      setOrderId(body.order.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '连接中断，请重试核查同一笔订单。') }
    finally { setBusy(false); requestLock.current = false }
  }
  return <main><AppWideShell className="pb-24 pt-5 sm:pt-8">
    <Button asChild variant="ghost" className="h-11"><Link href={`/store/products/${productId}`}>← 返回商品</Link></Button>
    <header className="mt-5 flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
      <div><p className="section-kicker">材料商城 · 结算</p><h1 className="mt-2 text-page-title">确认订单并支付</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">核对商品、收货信息和实付金额，确认后直接前往支付。</p></div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><span className="font-semibold text-foreground">确认信息</span><span aria-hidden>→</span><span>完成支付</span></p>
    </header>
    <form onSubmit={submit} className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
      <div className="min-w-0 space-y-5">
        <Surface className="p-5 sm:p-6"><h2 className="flex items-center gap-2 text-panel-title"><Package aria-hidden className="h-5 w-5 text-primary" />购买商品</h2>
          <div className="mt-5 flex gap-4"><div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted/50 sm:h-24 sm:w-24">{product?.cover_url ? <OptimizedImage src={product.cover_url} alt={product.name} fill variant="thumbnail" className="object-contain" /> : <Package aria-hidden className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />}</div><div className="min-w-0 py-1"><p className="break-words text-base font-semibold sm:text-lg">{product?.name || '正在加载商品…'}</p><p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">规格：{variant?.name || '加载中…'}</p><p className="mt-2 text-sm">数量：{quantity} 件</p></div></div>
          {product && !validQuantity ? <p role="alert" className="mt-3 text-sm text-destructive">该规格或数量暂不可购，请返回商品页重新选择。</p> : null}
          {product?.fulfillment_description ? <p className="mt-5 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">{product.fulfillment_description}</p> : null}
        </Surface>
        <Surface className="p-5 sm:p-6"><h2 className="flex items-center gap-2 text-panel-title"><MapPin aria-hidden className="h-5 w-5 text-primary" />收货信息</h2><p className="mt-2 text-sm text-muted-foreground">请填写能联系到你的手机号码和完整地址。</p>
          <fieldset disabled={!ready || attempted || busy || Boolean(orderId)} className="mt-5 grid gap-4 sm:grid-cols-2">
            {(['recipientName', 'phone'] as const).map((field, i) => <label key={field} className="grid gap-2 text-sm font-medium">{['收货人', '手机号'][i]}<Input required className="h-12" placeholder={field === 'phone' ? '请输入收货手机号' : '请输入收货人姓名'} autoComplete={field === 'phone' ? 'tel' : 'name'} type={field === 'phone' ? 'tel' : 'text'} value={address[field]} onChange={e => setAddress({ ...address, [field]: e.target.value })} /></label>)}
            <label className="grid gap-2 text-sm font-medium">省份<select disabled={recovering} className="control-field h-12 rounded-md px-3" value={province} onChange={e => { setQuote(null); setProvince(e.target.value) }}>{MAINLAND_PROVINCES.map(p => <option key={p}>{p}</option>)}</select></label>
            {(['city', 'district', 'street'] as const).map((field, i) => <label key={field} className={`grid gap-2 text-sm font-medium ${field === 'street' ? 'sm:col-span-2' : ''}`}>{['城市', '区县', '详细地址'][i]}<Input required className="h-12" placeholder={['如：北京市', '如：海淀区', '街道、小区、楼栋及门牌号'][i]} autoComplete={field === 'street' ? 'street-address' : 'off'} value={address[field]} onChange={e => setAddress({ ...address, [field]: e.target.value })} /></label>)}
          </fieldset>
        </Surface>
        <Surface className="p-5 sm:p-6"><h2 className="flex items-center gap-2 text-panel-title"><Tag aria-hidden className="h-5 w-5 text-primary" />优惠选择</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">会员优惠自动计算，可选择一张优惠券。</p>
          <fieldset disabled={!ready || attempted || recovering || busy || Boolean(orderId)} className="mt-5 min-w-0 space-y-3"><legend className="sr-only">优惠方式</legend>{[{ id: 'none', title: '不使用优惠券' }, ...coupons.filter(c => c.eligible && c.eligible_product_ids?.includes(productId)).map(c => ({ id: `coupon:${c.id}`, title: `${c.title} · 满${money(c.threshold_cents)}减${money(c.discount_cents)} · ${new Date(c.expires_at).toLocaleDateString('zh-CN')}到期` }))].map(option => <label key={option.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm leading-6 transition-colors ${discount === option.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}><input className="h-4 w-4 shrink-0 accent-primary" type="radio" name="discount" value={option.id} checked={discount === option.id} onChange={() => { setQuote(null); setError(''); setDiscount(option.id) }} /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{option.title}</span></label>)}</fieldset>
          <details className="mt-4 text-sm text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">查看优惠规则</summary><p className="leading-6">有效 Pro 会员商品 8.8 折，创始会员商品 8 折。优惠券门槛按会员折后商品金额计算；运费不参与优惠。硬币可在“我的硬币”中兑换优惠券。</p></details>
        </Surface>
      </div>
      <Surface className="min-w-0 p-5 sm:p-6 lg:sticky lg:top-24"><h2 className="mb-6 text-panel-title">付款明细</h2>
        {quote ? <StoreQuoteBreakdown quote={quote} /> : <p role="status" className="text-sm leading-6 text-muted-foreground">{!ready ? (lookupBusy ? '正在核查上次购买结果…' : '正在恢复购买记录…') : orderId ? '订单金额已确认，可继续支付。' : loadingQuote ? '正在获取最新报价…' : '报价暂不可用，请重新获取。'}</p>}
        {ready && !orderId && !quote && !loadingQuote && !attempted ? <Button type="button" variant="outline" className="mt-4 h-11" onClick={() => { setError(''); setReconfirm(v => v + 1) }}>重新获取报价</Button> : null}
        {recovering && !attempted && !orderId ? <Button type="button" variant="outline" className="mt-4 h-11" disabled={lookupBusy} onClick={() => void recoverIntent(true)}>重新核查并选择优惠</Button> : null}
        {lookupFailed ? <Button type="button" variant="outline" className="mt-4 h-11" disabled={lookupBusy} onClick={() => void recoverIntent()}>重试核查购买结果</Button> : null}
        {error ? <p role="alert" className="mt-5 rounded-xl bg-destructive/5 p-3 text-sm leading-6 text-destructive">{error}</p> : null}
        {attempted && !orderId ? <p className="mt-4 text-sm leading-6 text-muted-foreground">信息已锁定。网络超时后重试会核查同一笔订单，也可先前往我的订单查看。</p> : null}
        {!orderId ? <><fieldset disabled={busy || attempted} className="mt-6 border-t border-border pt-5"><legend className="sr-only">支付方式</legend><p className="mb-3 flex items-center gap-2 text-sm font-semibold"><CreditCard aria-hidden className="h-4 w-4" />支付方式</p>{paymentProviders.length ? <div className="flex flex-wrap gap-3">{paymentProviders.map(value => <label key={value} className={`flex min-h-12 flex-1 cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm ${provider === value ? 'border-primary bg-primary/5' : 'border-border'}`}><input className="accent-primary" type="radio" name="payment-provider" checked={provider === value} onChange={() => setProvider(value)} />{value === 'alipay' ? '支付宝' : '微信支付'}</label>)}</div> : <p className="text-sm leading-6 text-muted-foreground">当前暂不能付款；订单生成后仅保留 30 分钟。</p>}</fieldset>
          <Button type="submit" tone="brand" shape="pill" className="mt-6 h-12 w-full text-base" disabled={busy || !ready || (!attempted && (!quote || loadingQuote || !validQuantity))}>{busy ? '正在确认订单…' : attempted ? '重试核查同一笔订单' : paymentProviders.length ? '确认并立即支付' : '确认并生成订单'}</Button><p className="mt-3 text-center text-xs leading-5 text-muted-foreground">{paymentProviders.length ? '订单自动生成，随后打开支付页面' : '订单生成后，库存保留 30 分钟'}</p></> : <StoreCheckoutPayment key={orderId} orderId={orderId} provider={provider} autoStart={autoPay} />}
        <Button asChild variant="ghost" className="mt-3 h-11 w-full"><Link href="/store/orders">查看我的订单</Link></Button>
      </Surface>
    </form>
  </AppWideShell></main>
}
