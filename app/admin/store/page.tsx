import Link from 'next/link'
import type { Metadata } from 'next'
import { isDevelopmentMode } from '@/lib/development-only'
import { StoreCoupons } from '@/components/admin/store-coupons'
import { StoreNativeOperations } from '@/components/admin/store-native-operations'
import { requirePageRole } from '@/lib/auth/server'
import { isStoreCatalogVisible, isStoreCheckoutEnabled, isStorePaymentEnabled, isStorePreviewEnabled } from '@/lib/store/config'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '材料包运营', robots: { index: false, follow: false } }
export default async function AdminStorePage() {
  await requirePageRole(['admin'])
  const switches = [['公开目录', isStoreCatalogVisible()], ['新建订单', isStoreCheckoutEnabled()], ['支付宝', isStorePaymentEnabled('alipay')], ['微信支付', isStorePaymentEnabled('wechat')]] as const
  return <main className="min-h-screen bg-[hsl(var(--surface-sunken))] py-8"><div className="app-shell-standard"><Link href="/admin" className="text-sm font-medium text-primary">← 返回管理中心</Link><header className="mt-6 flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold tracking-widest text-primary">材料包运营</p><h1 className="mt-2 text-3xl font-bold">从材料准备，到作品完成</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">先维护少量商品和库存。订单支付确认后，人工采购、供应商代发，并在这里记录物流与处理售后。</p></div>{isStorePreviewEnabled() && <Link className="rounded-lg border bg-background px-4 py-3 text-sm font-medium text-primary" href="/admin/store/preview">打开隔离测试预览 →</Link>}</header><div className="mt-6 flex flex-wrap gap-3">{switches.map(([label,on]) => <span key={label} className="rounded-full border bg-background px-3 py-1.5 text-xs">{label}：{on ? '已开启' : '关闭'}</span>)}</div>{isDevelopmentMode() ? <Link href="/admin/store/source-drafts" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-primary">审核本地商品素材草稿 →</Link> : null}<StoreNativeOperations /><StoreCoupons /></div></main>
}
