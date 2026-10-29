'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { storeJson } from '@/components/store/store-catalog-client'

type Template = { id: string; title: string }
type Offer = { id: string; template_id: string; coin_price: number; total_limit: number; per_user_limit: number; active: boolean; version: number; redeemed_count: number }
const empty = () => ({ id: '', templateId: '', coinPrice: 0, totalLimit: 0, perUserLimit: 0, active: false, expectedVersion: undefined as number | undefined })
export function StoreCouponOffers({ templates }: { templates: Template[] }) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [draft, setDraft] = useState(empty)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function load() { const result = await storeJson<{ offers: Offer[] }>('/api/admin/store/coupon-offers'); setOffers(result.offers ?? []) }
  useEffect(() => {
    let active = true
    void storeJson<{ offers: Offer[] }>('/api/admin/store/coupon-offers')
      .then(result => { if (active) setOffers(result.offers ?? []) })
      .catch(error => { if (active) setMessage(error.message) })
    return () => { active = false }
  }, [])
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try { await storeJson('/api/admin/store/coupon-offers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...draft, id: draft.id || undefined }) }); await load(); setMessage('兑换配置已保存；已发券条款和累计兑换数量保持不变。') }
    catch (e) { setMessage(e instanceof Error ? e.message : '兑换配置保存失败') }
    finally { setBusy(false) }
  }
  return <section className="mt-8 border-t pt-6"><h3 className="text-panel-title">硬币兑换优惠券</h3><p className="mt-3 text-sm text-muted-foreground">所有登录用户均可兑换和使用。配置硬币价格及限额后再启用；取消订单或整单退款只退原券，不退硬币、不延期。</p>
    <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm">兑换配置<select className="control-field h-11" value={draft.id} onChange={e => { const o = offers.find(o => o.id === e.target.value); setDraft(o ? { id: o.id, templateId: o.template_id, coinPrice: o.coin_price, totalLimit: o.total_limit, perUserLimit: o.per_user_limit, active: o.active, expectedVersion: o.version } : empty()) }}><option value="">新建兑换草稿</option>{offers.map(o => <option key={o.id} value={o.id}>{templates.find(t => t.id === o.template_id)?.title || '优惠券'} · {o.active ? '启用' : '停兑'} · 已兑 {o.redeemed_count}</option>)}</select></label>
      <label className="grid gap-2 text-sm">优惠券模板<select required disabled={Boolean(draft.id)} className="control-field h-11" value={draft.templateId} onChange={e => setDraft({ ...draft, templateId: e.target.value })}><option value="">请选择模板</option>{templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      {([['coinPrice', '每张所需硬币'], ['totalLimit', '累计兑换总上限'], ['perUserLimit', '每人累计限兑']] as const).map(([key, label]) => <label key={key} className="grid gap-2 text-sm">{label}<Input type="number" required min={1} step={1} value={draft[key] || ''} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })} /></label>)}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />开放兑换</label><Button type="submit" disabled={busy}>{busy ? '正在保存…' : '保存兑换配置'}</Button>
    </form>{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}
  </section>
}
