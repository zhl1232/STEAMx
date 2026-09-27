'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw, Truck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Payment = { kind: 'redirect' | 'qr'; url?: string; codeUrl?: string }

export function StoreOrderActions({
  orderId,
  status,
  paymentStatus,
  aftersale,
  shipment,
  onChanged,
}: {
  orderId: string
  status: string
  paymentStatus: string
  aftersale?: { status?: string; returnAddress?: string | null } | null
  shipment?: { carrier?: string | null; trackingNumber?: string | null } | null
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [payment, setPayment] = useState<Payment | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (status !== 'pending_payment' && aftersale?.status !== 'refund_pending')
      return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    const poll = async () => {
      try {
        const response = await fetch(`/api/store/orders/${orderId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (response.ok) {
          const body = (await response.json()) as {
            order?: {
              status?: string
              payment_status?: string
              aftersale?: { status?: string }
            }
          }
          if (
            body.order &&
            (body.order.status !== status ||
              body.order.payment_status !== paymentStatus ||
              body.order.aftersale?.status !== aftersale?.status)
          ) {
            if (body.order.status !== 'pending_payment') setPayment(null)
            router.refresh()
          }
        }
      } catch {
        /* Transient network errors leave the last confirmed state visible. */
      } finally {
        if (!stopped) timer = setTimeout(poll, 5000)
      }
    }
    timer = setTimeout(poll, 5000)
    return () => {
      stopped = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [orderId, status, paymentStatus, aftersale?.status, router])

  const call = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(action)
    setError(null)
    try {
      const response = await fetch(`/api/store/orders/${orderId}/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || '操作失败')
      onChanged?.()
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败')
    } finally {
      setBusy(null)
    }
  }

  const startPayment = async (provider: 'alipay' | 'wechat') => {
    setBusy(provider)
    setError(null)
    try {
      const response = await fetch(`/api/store/orders/${orderId}/payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider,
          device: /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || '支付暂不可用')
      setPayment(result.payment)
      if (result.payment?.kind === 'redirect' && result.payment.url)
        window.location.assign(result.payment.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '支付暂不可用')
    } finally {
      setBusy(null)
    }
  }

  const canPay =
    paymentStatus !== 'paid' && ['pending_payment', 'failed'].includes(status)
  const canCancel = status === 'pending_payment'
  const canRefund =
    paymentStatus === 'paid' &&
    ['paid', 'sourcing', 'ordered', 'shipped', 'delivered'].includes(status)
  const canReturn = aftersale?.status === 'return_required'
  const canConfirm = status === 'shipped'
  // Keep logistics and aftersales readable even after all actions are finished.

  return (
    <section className="mt-6 border-t border-border/70 pt-5">
      <h2 className="text-sm font-semibold">订单进度与操作</h2>
      {aftersale?.status && (
        <p className="mt-3 rounded-lg bg-muted p-3 text-sm">
          售后：
          {(
            {
              requested: '等待审核',
              return_required: '等待寄回商品',
              returned: '等待商家收货',
              refund_pending: '原路退款处理中',
              refunded: '已退款',
              rejected: '申请未通过，请联系客服',
              received: '已收到退货',
            } as Record<string, string>
          )[aftersale.status] || '处理中'}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canPay ? (
          <>
            <Button
              size="sm"
              tone="brand"
              disabled={Boolean(busy)}
              onClick={() => startPayment('alipay')}
            >
              {busy === 'alipay' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              支付宝支付
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => startPayment('wechat')}
            >
              微信支付
            </Button>
          </>
        ) : null}
        {canCancel ? (
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() => call('cancel', { reason })}
          >
            取消订单
          </Button>
        ) : null}
        {canRefund ? (
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(busy) || !reason.trim()}
            onClick={() => call('request_refund', { reason })}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            申请退款
          </Button>
        ) : null}
        {canConfirm ? (
          <Button
            size="sm"
            tone="brand"
            disabled={Boolean(busy)}
            onClick={() => call('confirm_delivery')}
          >
            <Truck className="mr-2 h-4 w-4" />
            确认收货
          </Button>
        ) : null}
      </div>
      {canRefund || canCancel ? (
        <Input
          aria-label="操作原因"
          required={canRefund}
          className="mt-3 max-w-lg"
          placeholder={canRefund ? '退款原因（必填）' : '取消原因（可选）'}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      ) : null}
      {canReturn ? (
        <div className="mt-4">
          <p className="rounded bg-muted p-3 text-sm">
            请将商品寄回：{aftersale?.returnAddress || '退货地址待客服联系提供'}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Input
              aria-label="物流公司"
              placeholder="物流公司"
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
            />
            <Input
              aria-label="退货单号"
              placeholder="退货单号"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
            />
            <Button
              disabled={
                Boolean(busy) || !carrier.trim() || !trackingNumber.trim()
              }
              onClick={() =>
                call('return_shipped', { carrier, trackingNumber })
              }
            >
              提交退货物流
            </Button>
          </div>
        </div>
      ) : null}
      {shipment?.trackingNumber ? (
        <p className="mt-4 text-sm text-muted-foreground">
          物流：{shipment.carrier || '承运商'} · {shipment.trackingNumber}
        </p>
      ) : null}
      {payment?.kind === 'qr' && payment.codeUrl ? (
        <div className="mt-4 rounded-lg bg-muted p-3 text-center text-sm">
          <QRCodeSVG
            role="img"
            aria-label="微信支付二维码"
            value={payment.codeUrl}
            size={176}
            className="mx-auto"
          />
          <p className="mt-2">请扫码完成支付，页面会自动检查支付状态。</p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}
