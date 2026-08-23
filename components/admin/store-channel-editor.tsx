'use client'

import { useState } from 'react'
import { CheckCircle2, CircleAlert, ExternalLink, Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ChannelProduct = {
  id: string
  name: string
  checkout_mode: string
  external_channel: string | null
  external_url: string | null
  context_keys: string[]
}

type Draft = {
  checkoutMode: 'internal' | 'external'
  externalUrl: string
  contextKeys: string
}

function buildDrafts(products: ChannelProduct[]) {
  return Object.fromEntries(products.map((product) => [product.id, {
    checkoutMode: product.checkout_mode === 'external' ? 'external' : 'internal',
    externalUrl: product.external_url || '',
    contextKeys: product.context_keys?.join(', ') || '',
  }])) as Record<string, Draft>
}

export function StoreChannelEditor({ products }: { products: ChannelProduct[] }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => buildDrafts(products))
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const save = async (product: ChannelProduct) => {
    const draft = drafts[product.id]
    if (!draft) return
    setSavingId(product.id)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/store/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          checkout_mode: draft.checkoutMode,
          external_channel: draft.checkoutMode === 'external' ? 'taobao' : null,
          external_url: draft.checkoutMode === 'external' ? draft.externalUrl : null,
          context_keys: draft.contextKeys,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || '保存失败')
      setMessage({ kind: 'success', text: `「${product.name}」的购买入口已更新` })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '保存失败' })
    } finally {
      setSavingId(null)
    }
  }

  if (!products.length) {
    return (
      <section className="mt-6 rounded-sm border border-dashed border-border/80 px-5 py-6 text-sm text-muted-foreground">
        还没有可配置的商品。先录入商品后，再为需要外部结算的 SKU 配置淘宝链接。
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-sm border border-border/70 bg-background p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">商品购买入口</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            淘宝商品由淘宝完成支付、物流和售后；这里只配置展示卡片的跳转地址，不会嵌入淘宝收银台。
          </p>
        </div>
        <ExternalLink className="h-5 w-5 shrink-0 text-[hsl(var(--brand-blue))]" />
      </div>

      {message ? (
        <div className={`mt-4 flex items-start gap-2 rounded-sm px-3 py-2 text-sm ${message.kind === 'success' ? 'bg-[hsl(var(--status-success)/0.1)] text-[hsl(var(--status-success-foreground))]' : 'bg-destructive/5 text-destructive'}`}>
          {message.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {products.map((product) => {
          const draft = drafts[product.id]
          const saving = savingId === product.id
          return (
            <div key={product.id} className="rounded-sm border border-border/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{product.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">商品 ID：{product.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`mode-${product.id}`}>购买入口</label>
                  <select
                    id={`mode-${product.id}`}
                    value={draft?.checkoutMode || 'internal'}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [product.id]: { ...current[product.id], checkoutMode: event.target.value === 'external' ? 'external' : 'internal' },
                    }))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="external">淘宝外部结算</option>
                    <option value="internal">本站订单（过渡）</option>
                  </select>
                  <Button type="button" size="sm" tone="brand" disabled={saving} onClick={() => save(product)}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    保存
                  </Button>
                </div>
              </div>
              {draft?.checkoutMode === 'external' ? (
                <div className="mt-3">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`url-${product.id}`}>淘宝/天猫商品或店铺链接</label>
                  <Input
                    id={`url-${product.id}`}
                    className="mt-1"
                    value={draft.externalUrl}
                    placeholder="https://item.taobao.com/item.htm?id=…"
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [product.id]: { ...current[product.id], externalUrl: event.target.value },
                    }))}
                  />
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">仅接受 HTTPS 淘宝/天猫域名；短链可用，但请先用真实账号验证能打开商品页。</p>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">该商品仍走本站订单过渡流程；支付通道接入前不会向用户承诺已支付。</p>
              )}
              <div className="mt-3">
                <label className="text-xs font-medium text-muted-foreground" htmlFor={`context-${product.id}`}>挂载到课程/项目（可选）</label>
                <Input
                  id={`context-${product.id}`}
                  className="mt-1"
                  value={draft?.contextKeys || ''}
                  placeholder="course:12, lesson:34, project:56"
                  onChange={(event) => setDrafts((current) => ({
                    ...current,
                    [product.id]: { ...current[product.id], contextKeys: event.target.value },
                  }))}
                />
                <p className="mt-1 text-xs leading-5 text-muted-foreground">保存后，匹配的课程/课时/项目详情页会显示材料包卡片。</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
