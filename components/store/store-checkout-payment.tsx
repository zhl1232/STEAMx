'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { money, storeJson } from './store-catalog-client'

type Provider = 'alipay' | 'wechat'
type Order = { status: string; payment_status: string; total_cents: number }
type Payment = { kind: 'redirect' | 'qr'; url?: string; codeUrl?: string }

export function StoreCheckoutPayment({ orderId, provider, autoStart = false }: { orderId: string; provider?: Provider; autoStart?: boolean }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lifecycle = useRef<AbortController | null>(null)
  const lock = useRef<AbortSignal | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifecycle.current = controller
    return () => {
      controller.abort()
      if (lock.current === controller.signal) lock.current = null
    }
  }, [])
  const readOrder = useCallback(async (signal: AbortSignal) => {
    const result = await storeJson<{ order: Order }>(`/api/store/orders/${orderId}`, { cache: 'no-store', signal })
    signal.throwIfAborted()
    if (!result.order?.status) throw new Error('暂时无法确认订单状态，请重试。')
    setOrder(result.order)
    return result.order
  }, [orderId])
  const pay = useCallback(async () => {
    const signal = lifecycle.current?.signal
    if (!signal || signal.aborted || lock.current === signal || !provider) return
    lock.current = signal
    setBusy(true); setError('')
    try {
      const current = await readOrder(signal)
      signal.throwIfAborted()
      if (current.payment_status === 'paid' || !['pending_payment', 'failed'].includes(current.status)) return
      const { payment: next } = await storeJson<{ payment: Payment }>(`/api/store/orders/${orderId}/payment`, {
        method: 'POST', signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, device: /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop' }),
      })
      signal.throwIfAborted()
      if (next?.kind === 'redirect' && next.url) {
        setPayment(next)
        window.location.assign(next.url)
      } else if (next?.kind === 'qr' && next.codeUrl) setPayment(next)
      else throw new Error('暂时无法打开支付，请重试。')
    } catch (cause) { if (!signal.aborted) setError(cause instanceof Error ? cause.message : '暂时无法打开支付，请重试。') }
    finally { if (!signal.aborted) setBusy(false); if (lock.current === signal) lock.current = null }
  }, [orderId, provider, readOrder])
  useEffect(() => {
    const signal = lifecycle.current?.signal
    if (!signal || signal.aborted) return
    if (autoStart && provider) void pay()
    else void readOrder(signal).catch(cause => { if (!signal.aborted) setError(cause instanceof Error ? cause.message : '暂时无法确认订单状态。') })
  }, [autoStart, provider, pay, readOrder])
  useEffect(() => {
    if (!order || order.payment_status === 'paid' || !['pending_payment', 'failed'].includes(order.status)) return
    let stopped = false
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try { await readOrder(controller.signal) } catch { /* Keep the last confirmed order visible during transient failures. */ }
      if (!stopped) timer = setTimeout(poll, 5000)
    }
    timer = setTimeout(poll, 5000)
    return () => { stopped = true; clearTimeout(timer); controller.abort() }
  }, [order, readOrder])
  const paid = order?.payment_status === 'paid'
  const closed = order && !paid && !['pending_payment', 'failed'].includes(order.status)
  return <div className="mt-6 space-y-4" aria-live="polite">
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <p className="flex items-center gap-2 font-semibold">{paid ? <CheckCircle2 className="h-5 w-5 text-primary" /> : null}{paid ? '支付成功' : closed ? '订单已结束' : '订单已生成'}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{paid ? '已确认收款，可在订单中查看后续进度。' : closed ? '请查看订单了解当前进度。' : '请在订单生成后 30 分钟内完成付款。支付未完成时，可在此继续。'}</p>
      {order ? <p className="mt-3 text-sm">{paid ? '实付金额' : closed ? '订单金额' : '待付金额'} <span className="ml-2 text-xl font-semibold tabular-nums">{money(order.total_cents)}</span></p> : null}
    </div>
    {!paid && !closed && provider ? <Button type="button" tone="brand" shape="pill" className="h-12 w-full" disabled={busy} onClick={() => void pay()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{busy ? '正在打开支付…' : payment ? '重新打开支付' : '继续支付'}</Button> : null}
    {!paid && !closed && !provider ? <p className="text-sm leading-6 text-muted-foreground">支付通道暂未开放，请联系商城客服。</p> : null}
    {!paid && !closed && payment?.kind === 'qr' && payment.codeUrl ? <div className="rounded-xl border bg-white p-5 text-center text-sm text-black"><QRCodeSVG role="img" aria-label="微信支付二维码" value={payment.codeUrl} size={176} className="mx-auto" /><p className="mt-4">使用微信扫码支付</p><p className="mt-2 text-xs">付款后会自动更新结果，请勿重复付款。</p></div> : null}
    {error ? <p role="alert" className="text-sm leading-6 text-destructive">{error}</p> : null}
    <Button asChild type="button" variant="outline" className="h-11 w-full"><Link href={`/store/orders/${orderId}`}>查看订单详情</Link></Button>
  </div>
}
