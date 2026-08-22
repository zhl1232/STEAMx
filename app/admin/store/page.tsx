import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Package,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react'

import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { Button } from '@/components/ui/button'
import { requirePageRole } from '@/lib/auth/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '1688 商城管理',
  robots: { index: false, follow: false },
}

type AdminStorePageProps = {
  searchParams: Promise<{ alibaba?: string | string[] }>
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string | null | undefined) {
  if (!value) return '未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未记录' : date.toLocaleString('zh-CN')
}

function formatScopes(scopes: string[] | null | undefined) {
  if (!scopes?.length) return '未返回授权范围'
  return scopes.join('、')
}

export default async function AdminStorePage({ searchParams }: AdminStorePageProps) {
  await requirePageRole(['admin'])
  const query = await searchParams
  const alibabaState = firstSearchParam(query.alibaba)

  let connection: {
    member_id: string | null
    expires_at: string | null
    scopes: string[]
    status: string
    updated_at: string
  } | null = null
  let catalogCounts = { suppliers: 0, products: 0, variants: 0, sources: 0 }
  let loadError: string | null = null

  if (!supabaseAdmin) {
    loadError = '数据库管理员密钥尚未配置，暂时无法读取商城运营状态。'
  } else {
    const [connectionResult, suppliersResult, productsResult, variantsResult, sourcesResult] = await Promise.all([
      supabaseAdmin
        .from('store_alibaba_connections')
        .select('member_id, expires_at, scopes, status, updated_at')
        .eq('connection_key', 'default')
        .maybeSingle(),
      supabaseAdmin.from('store_suppliers').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('store_products').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('store_product_variants').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('store_product_sources').select('id', { count: 'exact', head: true }),
    ])

    if (connectionResult.error) loadError = '商城状态加载失败，请稍后刷新。'
    else connection = connectionResult.data

    const countErrors = [suppliersResult, productsResult, variantsResult, sourcesResult].some((result) => result.error)
    if (countErrors) loadError = '商城目录统计加载失败，请稍后刷新。'
    else {
      catalogCounts = {
        suppliers: suppliersResult.count ?? 0,
        products: productsResult.count ?? 0,
        variants: variantsResult.count ?? 0,
        sources: sourcesResult.count ?? 0,
      }
    }
  }

  const isConnected = connection?.status === 'active'
  const isExpired = connection?.status === 'expired'
  const connectionLabel = isConnected ? '已连接' : isExpired ? '授权已过期' : '未连接'
  const connectionTone = isConnected
    ? 'bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))]'
    : 'bg-[hsl(var(--status-warning)/0.14)] text-[hsl(var(--status-warning-foreground))]'

  return (
    <div className="page-shell pt-6 pb-24 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader title="1688 商城管理" fallbackHref="/admin" />
      </div>

      <section className="surface-panel overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="section-kicker">商城运营</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">1688 实物商城</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  管理 1688 授权、供应商和材料包目录。敏感 token 只保存在服务端，不会展示在页面或浏览器中。
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回后台
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/store">
                <ExternalLink className="mr-2 h-4 w-4" />
                查看商城
              </Link>
            </Button>
          </div>
        </div>

        {alibabaState === 'connected' ? (
          <div className="mt-6 flex items-start gap-3 rounded-sm border border-[hsl(var(--status-success)/0.26)] bg-[hsl(var(--status-success)/0.08)] px-4 py-3 text-sm text-[hsl(var(--status-success-foreground))]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>1688 授权已完成，凭证已加密保存。请继续核对授权范围和供应商目录。</p>
          </div>
        ) : null}

        {loadError ? (
          <div className="mt-6 flex items-start gap-3 rounded-sm border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{loadError}</p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="rounded-sm border border-border/70 bg-[hsl(var(--surface-raised)/0.64)] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">1688 授权连接</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">订单提交前必须先完成供应商账号授权。</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${connectionTone}`}>
                {isConnected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
                {connectionLabel}
              </span>
            </div>

            <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">1688 会员 ID</dt>
                <dd className="mt-1 break-all text-sm font-medium text-foreground">{connection?.member_id || '未授权'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">授权状态</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{connection ? connectionLabel : '尚未建立连接'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">授权范围</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{formatScopes(connection?.scopes)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">授权到期</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{formatDate(connection?.expires_at)}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[hsl(var(--brand-green))]" />
                最近更新：{formatDate(connection?.updated_at)}
              </p>
              <Button asChild tone="brand" size="sm">
                <Link href="/api/store/alibaba/oauth/start">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isConnected ? '重新授权' : '连接 1688'}
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              OAuth 回调地址应配置为{' '}
              <code className="break-all rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">/api/store/alibaba/oauth/callback</code>
              。授权过程中不会把 access token 返回给浏览器。
            </p>
          </section>

          <section className="rounded-sm border border-border/70 bg-background p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">目录准备情况</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">数据库结构已就绪，当前只显示统计。</p>
              </div>
              <Package className="h-5 w-5 text-[hsl(var(--brand-blue))]" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ['供应商', catalogCounts.suppliers],
                ['商品', catalogCounts.products],
                ['SKU', catalogCounts.variants],
                ['1688 映射', catalogCounts.sources],
              ].map(([label, value]) => (
                <div key={label} className="rounded-sm bg-[hsl(var(--surface-sunken)/0.72)] px-3 py-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-sm bg-[hsl(var(--brand-amber)/0.1)] px-4 py-3 text-sm leading-6 text-foreground">
              <Truck className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--brand-amber-foreground))]" />
              <p>
                {catalogCounts.products === 0
                  ? '还没有商品数据。完成 1688 授权后，下一步录入供应商、商品、SKU 和 offer/spec 映射。'
                  : '商品目录已存在。支付接入前请确认每个可售 SKU 都有有效的 1688 映射。'}
              </p>
            </div>
          </section>
        </div>

        <section className="mt-6 border-t border-border/70 pt-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">上线前顺序</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">当前第 1 步</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ['01', '完成 1688 授权', '确认开放平台凭证、Scope 和回调地址。'],
              ['02', '录入商品映射', '建立供应商、商品、SKU 与 offer/spec 关系。'],
              ['03', '接入支付与履约', '支付 webhook 确认后，再启用 1688 下单任务。'],
            ].map(([step, title, description]) => (
              <div key={step} className="flex gap-3 rounded-sm border border-border/70 px-4 py-4">
                <span className="text-sm font-bold tabular-nums text-[hsl(var(--brand-blue))]">{step}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}
