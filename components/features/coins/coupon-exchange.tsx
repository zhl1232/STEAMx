'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/context/auth-context'
import { useGamification } from '@/lib/context/gamification-context'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { money, storeJson } from '@/components/store/store-catalog-client'

type Offer = { id: string; version: string; coin_price: number; title: string; threshold_cents: number; discount_cents: number; valid_days: number; terms: string; eligible_product_ids: string[]; eligible_products?: { id: string; name: string }[]; per_user_limit: number; user_redeemed: number; available: boolean }
type Intent = { offerId: string; expectedVersion: string; idempotencyKey: string }
export default function CouponExchange() {
  const { user, refreshProfile } = useAuth()
  const { coins = 0 } = useGamification()
  const client = useQueryClient()
  const storageKey = `coupon-exchange:${user?.id}`
  const [selected, setSelected] = useState<Offer | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const offers = useQuery({ queryKey: ['coupon-offers', user?.id], enabled: !!user, queryFn: () => storeJson<{ offers: Offer[]; enabled: boolean }>('/api/coins/coupon-offers', { cache: 'no-store' }) })
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- Restore an unfinished exchange from browser storage.
    try { const saved = sessionStorage.getItem(storageKey); if (saved) { const parsed = JSON.parse(saved); if (typeof parsed.offerId === 'string' && typeof parsed.expectedVersion === 'string' && typeof parsed.idempotencyKey === 'string') setIntent(parsed) } } catch { /* Storage is optional. */ }
  }, [storageKey])
  async function complete() {
    setSuccess(true); setSelected(null); setIntent(null)
    try { sessionStorage.removeItem(storageKey) } catch { /* Storage is optional. */ }
    setMessage('兑换成功，优惠券已存入我的优惠券。')
    await Promise.all([refreshProfile(), client.invalidateQueries({ queryKey: ['coupon-offers', user?.id] }), client.invalidateQueries({ queryKey: ['coin_logs', user?.id] }), client.invalidateQueries({ queryKey: ['shop_prices', user?.id] }), client.invalidateQueries({ queryKey: ['store-coupons'] })])
  }
  async function exchange() {
    if (!selected && !intent) return
    const attempt = intent ?? { offerId: selected!.id, expectedVersion: selected!.version, idempotencyKey: crypto.randomUUID() }
    setIntent(attempt); setBusy(true); setMessage(''); setSuccess(false)
    try { sessionStorage.setItem(storageKey, JSON.stringify(attempt)) } catch { /* The current tab still keeps the intent. */ }
    try {
      if (intent) {
        const result = await storeJson<{ exchange: unknown | null }>(`/api/coins/coupon-exchanges?intent=${encodeURIComponent(attempt.idempotencyKey)}`, { cache: 'no-store' })
        if (result.exchange) { await complete(); return }
      }
      const response = await fetch('/api/coins/coupon-exchanges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(attempt) })
      const body = await response.json()
      if (!response.ok) {
        if (['OFFER_CHANGED', 'OFFER_UNAVAILABLE', 'INSUFFICIENT_COINS', 'EXCHANGE_LIMIT', 'INTENT_CONFLICT', 'VALIDATION_ERROR'].includes(body.code)) { setIntent(null); setSelected(null); try { sessionStorage.removeItem(storageKey) } catch { /* Optional. */ }; await offers.refetch() }
        throw new Error(body.error || '兑换失败，请刷新后重新确认。')
      }
      await complete()
    } catch (error) { setMessage(error instanceof Error ? error.message : '结果暂未确认，请核查同一次兑换。') }
    finally { setBusy(false) }
  }
  return <section className="space-y-5" aria-label="优惠券兑换"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-panel-title">用硬币兑换材料优惠券</h2><Button asChild variant="outline"><Link href="/store/coupons">我的优惠券</Link></Button></div>
    <p className="text-sm text-muted-foreground">所有登录用户均可兑换。兑换后不退硬币；订单取消或整单退款确认后退回原券，不延长有效期。</p>
    {message ? <p role="status">{message}</p> : null}
    {success ? <Link className="text-primary underline" href="/store/coupons">查看我的优惠券</Link> : null}
    {intent ? <Surface className="space-y-3 p-5"><p>有一笔兑换结果待核查，请先确认，避免重复兑换。</p><Button disabled={busy} onClick={() => void exchange()}>{busy ? '正在核查…' : '核查同一次兑换'}</Button></Surface> : null}
    {offers.isPending ? <p role="status">正在加载可兑换优惠券…</p> : offers.isError ? <div><p role="alert">优惠券暂时无法加载。</p><Button variant="outline" onClick={() => void offers.refetch()}>重试</Button></div> : !offers.data?.enabled || !offers.data.offers.length ? <Surface className="p-6">优惠券兑换暂未开放。你可以先兑换装扮或继续探索。</Surface> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{offers.data.offers.map(offer => <Surface className="space-y-3 p-5" key={offer.id}><h3 className="text-panel-title">{offer.title}</h3><p>满{money(offer.threshold_cents)}减{money(offer.discount_cents)}</p><p className="text-sm text-muted-foreground">兑换后 {offer.valid_days} 天有效 · 每人累计限兑 {offer.per_user_limit} 张 · 已兑 {offer.user_redeemed} 张</p><p className="text-sm">适用商品：{offer.eligible_products?.map(product => product.name).join("、") || "请查看券面使用条款"}</p><p className="whitespace-pre-line text-sm">{offer.terms}</p><Button disabled={busy || !!intent || !offer.available || coins < offer.coin_price} onClick={() => setSelected(offer)}>{!offer.available ? '暂不可兑换' : coins < offer.coin_price ? '硬币不足' : `${offer.coin_price} 硬币兑换`}</Button></Surface>)}</div>}
    {selected && !intent ? <Surface role="region" aria-label="确认兑换" className="space-y-4 border-primary p-5"><h3 className="text-panel-title">确认兑换「{selected.title}」</h3><p>消耗 {selected.coin_price} 硬币，获得满{money(selected.threshold_cents)}减{money(selected.discount_cents)}优惠券，兑换后 {selected.valid_days} 天有效。</p><p className="text-sm">适用商品：{selected.eligible_products?.map(product => product.name).join("、") || "请查看券面使用条款"}</p><p className="whitespace-pre-line text-sm">{selected.terms}</p><p className="text-sm">仅适用于券指定商品，不抵运费。兑换后不退硬币。</p><div className="flex gap-3"><Button disabled={busy} onClick={() => void exchange()}>确认兑换</Button><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>取消</Button></div></Surface> : null}
  </section>
}
