'use client'

import { useEffect, useRef, useState } from 'react'
import { StoreCouponOffers } from './store-coupons-offers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Surface } from '@/components/ui/surface'
import { money, storeJson } from '@/components/store/store-catalog-client'

type Template = { id: string; title: string; threshold_cents: number; discount_cents: number; valid_days: number; terms: string; active: boolean; eligible_product_ids: string[] }
type Product = { id: string; name: string }
type Batch = { id: string; template_id: string; created_at: string; granted_count?: number; batch_key?: string }
const empty = () => ({ id: '', title: '满50减5材料券', thresholdCents: 5000, discountCents: 500, validDays: 0, terms: '', eligibleProductIds: [] as string[], active: false })
export function StoreCoupons() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [draft, setDraft] = useState(empty)
  const [templateId, setTemplateId] = useState('')
  const [recipients, setRecipients] = useState('')
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const batchKey = useRef('')
  const [batchAttempted, setBatchAttempted] = useState(false)
  async function load() {
    const [coupons, catalog, history] = await Promise.all([
      storeJson<{ templates: Template[] }>('/api/admin/store/coupons'),
      storeJson<{ products: Product[] }>('/api/admin/store/catalog'),
      storeJson<{ batches: Batch[] }>('/api/admin/store/coupons/batches'),
    ])
    setTemplates(coupons.templates); setProducts(catalog.products); setBatches(history.batches)
  }
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- Fetch persisted templates and batch history on mount.
    void load().catch(e => setMessage(e.message))
  }, [])
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try { await storeJson('/api/admin/store/coupons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...draft, validDays: draft.validDays || null, id: draft.id || undefined }) }); await load(); setMessage('优惠券模板已保存；不会自动发券。') }
    catch (e) { setMessage(e instanceof Error ? e.message : '保存失败') }
    finally { setBusy(false) }
  }
  const selected = templates.find(t => t.id === templateId)
  const userIds = [...new Set(recipients.split(/[,，\s]+/).filter(Boolean))]
  const validRecipients = userIds.length > 0 && userIds.length <= 500 && userIds.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  async function issue() {
    setBusy(true); setMessage('')
    setBatchAttempted(true)
    if (!batchKey.current) batchKey.current = `admin-${crypto.randomUUID()}`
    try {
      const result = await storeJson<{ grantedCount: number }>('/api/admin/store/coupons/batches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId, batchKey: batchKey.current, userIds }) })
      await load(); setMessage(`已确认发放 ${result.grantedCount} 张优惠券。`); setReview(false); setRecipients(''); batchKey.current = ''; setBatchAttempted(false)
    } catch (e) { setMessage(e instanceof Error ? e.message : '发放结果暂未确认，请重试核查同一批次。') }
    finally { setBusy(false) }
  }
  return <Surface className="mt-8 p-5 sm:p-7"><header className="flex flex-wrap items-center justify-between gap-3"><div><p className="section-kicker">人工优惠</p><h2 className="mt-2 text-panel-title">优惠券模板与批次发放</h2></div><Button variant="outline" onClick={() => setDraft(empty())}>新建模板草稿</Button></header><p className="mt-3 text-sm leading-6 text-muted-foreground">优惠券由管理员明确发放，不自动赠送。创始会员资格在领券与使用时分别核验；每位收件人一张，数量以确认名单为准。</p>
    <div className="mt-6 grid gap-7 lg:grid-cols-2"><form className="space-y-4" onSubmit={save}><label className="grid gap-2 text-sm">编辑模板<select className="control-field h-11" value={draft.id} onChange={e => { const t = templates.find(t => t.id === e.target.value); setDraft(t ? { id: t.id, title: t.title, thresholdCents: t.threshold_cents, discountCents: t.discount_cents, validDays: t.valid_days || 0, terms: t.terms, active: t.active, eligibleProductIds: t.eligible_product_ids || [] } : empty()) }}><option value="">新模板</option>{templates.map(t => <option value={t.id} key={t.id}>{t.title} · {t.active ? '启用' : '草稿'}</option>)}</select></label><label className="grid gap-2 text-sm">优惠券名称<Input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><div className="grid grid-cols-2 gap-4">{[['thresholdCents', '使用门槛（分）'], ['discountCents', '优惠金额（分）'], ['validDays', '发放后有效天数']] .map(([key, title]) => <label className="grid gap-2 text-sm" key={key}>{title}<Input type="number" required min={key === 'validDays' && !draft.active ? 0 : 1} step={1} value={draft[key as 'thresholdCents' | 'discountCents' | 'validDays']} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })} /></label>)}</div><fieldset className="space-y-2"><legend className="mb-2 text-sm">适用商品（启用前必选）</legend>{products.length ? products.map(p => <label key={p.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.eligibleProductIds.includes(p.id)} onChange={e => setDraft({ ...draft, eligibleProductIds: e.target.checked ? [...draft.eligibleProductIds, p.id] : draft.eligibleProductIds.filter(id => id !== p.id) })} />{p.name}</label>) : <p className="text-sm text-muted-foreground">请先准备商品。</p>}</fieldset><label className="grid gap-2 text-sm">使用规则<textarea className="control-field min-h-24 p-3" required={draft.active} value={draft.terms} onChange={e => setDraft({ ...draft, terms: e.target.value })} /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />启用模板（具备适用商品、有效期和规则后可发放）</label><Button disabled={busy || (draft.active && (!draft.eligibleProductIds.length || !draft.validDays || !draft.terms.trim()))} type="submit">保存模板</Button></form>
    <div><h3 className="font-semibold">手动发放</h3><div className="mt-4 space-y-4"><label className="grid gap-2 text-sm">发放模板<select className="control-field h-11" disabled={review} value={templateId} onChange={e => { setTemplateId(e.target.value); batchKey.current = '' }}><option value="">请选择启用的模板</option>{templates.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label className="grid gap-2 text-sm">用户 UUID 名单（每行一个，最多 500 人）<textarea disabled={review} className="control-field min-h-32 p-3" value={recipients} onChange={e => { setRecipients(e.target.value); batchKey.current = '' }} /></label>{review && selected ? <Surface variant="subtle" className="space-y-3 p-4 text-sm"><p className="font-semibold">发放前确认</p><p>{selected.title} · 满 {money(selected.threshold_cents)} 减 {money(selected.discount_cents)}</p><p>适用商品 {selected.eligible_product_ids.length} 种 · 发放后 {selected.valid_days} 天到期</p><p>收件人 {userIds.length} 人 · 每人一张 · 共 {userIds.length} 张</p><p className="whitespace-pre-line">{selected.terms}</p><Button disabled={busy} onClick={issue}>{busy ? '正在核查发放…' : batchAttempted ? '重试核查同一批次' : '确认发放本批优惠券'}</Button>{!batchAttempted ? <Button variant="ghost" onClick={() => setReview(false)}>返回编辑</Button> : null}</Surface> : <Button disabled={busy || !selected || !validRecipients} variant="outline" onClick={() => setReview(true)}>核对名单与发放数量</Button>}</div><h3 className="mt-8 font-semibold">最近发放记录</h3><div className="mt-3 space-y-3">{batches?.length ? batches.map(b => <p key={b.id} className="break-all border-b pb-3 text-xs text-muted-foreground">批次 {b.id} · {new Date(b.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}{b.granted_count != null ? ` · ${b.granted_count} 张` : ''}</p>) : <p className="text-sm text-muted-foreground">暂无人工发放记录。</p>}</div></div></div>{message ? <p role="status" className="mt-6 text-sm">{message}</p> : null}
    <StoreCouponOffers templates={templates} />
  </Surface>
}
