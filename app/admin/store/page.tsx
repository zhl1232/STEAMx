import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Package,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react'

import { StoreChannelEditor } from '@/components/admin/store-channel-editor'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { Button } from '@/components/ui/button'
import { requirePageRole } from '@/lib/auth/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '实物商城管理',
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
  let catalogCounts = { suppliers: 0, products: 0, variants: 0, sources: 0, externalProducts: 0 }
  let channelProducts: Array<{
    id: string
    name: string
    checkout_mode: string
    external_channel: string | null
    external_url: string | null
    context_keys: string[]
  }> = []
  let loadError: string | null = null

  if (!supabaseAdmin) {
    loadError = '数据库管理员密钥尚未配置，暂时无法读取商城运营状态。'
  } else {
    const [connectionResult, suppliersResult, productsResult, variantsResult, sourcesResult, externalProductsResult, channelProductsResult] = await Promise.all([
      supabaseAdmin
        .from('store_alibaba_connections')
        .select('member_id, expires_at, scopes, status, updated_at')
        .eq('connection_key', 'default')
        .maybeSingle(),
      supabaseAdmin.from('store_suppliers').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('store_products').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('store_product_variants').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('store_product_sources').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('store_products').select('id', { count: 'exact', head: true }).eq('checkout_mode', 'external'),
      supabaseAdmin
        .from('store_products')
        .select('id, name, checkout_mode, external_channel, external_url, context_keys')
        .in('status', ['active', 'draft'])
        .order('created_at', { ascending: false })
        .limit(48),
    ])

    if (connectionResult.error) loadError = '商城状态加载失败，请稍后刷新。'
    else connection = connectionResult.data

    const countErrors = [suppliersResult, productsResult, variantsResult, sourcesResult, externalProductsResult, channelProductsResult].some((result) => result.error)
    if (countErrors) loadError = '商城目录统计加载失败，请稍后刷新。'
    else {
      catalogCounts = {
        suppliers: suppliersResult.count ?? 0,
        products: productsResult.count ?? 0,
        variants: variantsResult.count ?? 0,
        sources: sourcesResult.count ?? 0,
        externalProducts: externalProductsResult.count ?? 0,
      }
      channelProducts = channelProductsResult.data ?? []
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
        <MobilePageHeader title="实物商城管理" fallbackHref="/admin" />
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
                <h1 className="text-3xl font-semibold tracking-tight">实物商城运营</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  当前以淘宝商品卡片作为购买入口，支付、物流和售后由淘宝负责；1688 连接仅作为未来人工履约研究资料。敏感 token 只保存在服务端，不会展示在页面或浏览器中。
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
            <p>历史 1688 授权仍然存在，凭证已加密保存；当前淘宝外部结算不依赖这条连接。</p>
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
                <p className="text-sm font-semibold text-foreground">1688 备用连接</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">当前阶段不需要授权；这里只读显示历史连接状态，避免误启用自动下单。</p>
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
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">当前不启用自动下单</span>
            </div>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              只有进入后续开放平台评估阶段，才需要重新核对 OAuth 回调、授权范围和接口协议；当前淘宝外部结算不依赖 access token。
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
                ['淘宝外部商品', catalogCounts.externalProducts],
                ['备用货源映射', catalogCounts.sources],
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
                  ? '还没有商品数据。先录入少量固定材料包，再为需要外部结算的商品配置淘宝链接。'
                  : `${catalogCounts.externalProducts} 个商品已配置淘宝外部结算。上架前请人工核对商品页、价格、库存、运费和售后说明。`}
              </p>
            </div>
          </section>
        </div>

        <StoreChannelEditor products={channelProducts} />

        <section className="mt-6 border-t border-border/70 pt-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">上线前顺序</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">当前第 1 阶段</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ['01', '准备淘宝商品', '确认店铺主体、类目、收款、发货和售后规则。'],
              ['02', '配置商品卡片', '为商品填写淘宝链接，人工核对价格、规格和库存。'],
              ['03', '小流量验证', '验证点击、淘宝下单、发货和售后闭环，再扩大目录。'],
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
