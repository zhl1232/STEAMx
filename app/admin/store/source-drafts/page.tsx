import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePageRole } from '@/lib/auth/server'
import { isDevelopmentMode } from '@/lib/development-only'
import { AppStandardShell } from '@/components/layout/app-shell'
import { Surface } from '@/components/ui/surface'
import { OptimizedImage } from '@/components/ui/optimized-image'
import drafts from '@/data/store/source-drafts.json'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '实物商品素材审核', robots: { index: false, follow: false } }
const amount = (cents: number) => `¥${(cents / 100).toFixed(2)}`

export default async function StoreSourceDraftsPage() {
  if (!isDevelopmentMode()) notFound()
  await requirePageRole(['admin'])
  return (
    <main>
      <AppStandardShell className="pb-24 pt-8">
        <Link href="/admin/store" className="text-sm font-semibold text-primary">← 返回商城运营</Link>
        <header className="py-8">
          <p className="section-kicker">管理员 · 本地素材审核</p>
          <h1 className="mt-3 text-page-title">先认清商品，再准备上架</h1>
          <p className="mt-4 leading-7 text-muted-foreground">两件草稿商品、18 个原始规格。图片来自本地原始资料包，尚未确认货源映射；价格、运费和发货安排均待审核。此页读取静态草稿，不写数据库、不开放购买。</p>
        </header>
        <Surface variant="subtle" className="p-6">
          <h2 className="text-panel-title">上架前待确认</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
            {drafts.reviewItems.map(item => <li key={item}>{item}</li>)}
          </ul>
        </Surface>
        <section className="mt-8">
          <h2 className="text-panel-title">保留的原始图片</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">两条仓库商品复用同一组图片。下面只保留包装外观和实验示意作为审核候选，不能据此确认规格内容；不使用工厂能力、赠品、视频配套与买家秀宣传。</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {drafts.assets.map(asset => (
              <Surface key={asset.url} className="overflow-hidden">
                <a href={asset.url} target="_blank" rel="noreferrer" aria-label={`打开原图：${asset.label}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  <div className="relative aspect-square bg-muted/20"><OptimizedImage src={asset.url} alt={asset.label} fill className="object-contain" /></div>
                  <p className="p-4 text-sm leading-6">{asset.label}</p>
                </a>
              </Surface>
            ))}
          </div>
        </section>
        <div className="mt-10 space-y-8">
          {drafts.products.map(product => (
            <Surface key={product.id} className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="section-kicker">草稿 · 零库存 · 规格暂停销售</p><h2 className="mt-2 text-panel-title">{product.name}</h2><p className="mt-3 text-sm text-muted-foreground">{product.description}</p></div>
                <a href={product.warehouseUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary underline">查看原仓库商品</a>
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-7">拟用详情：{product.detailContent}</p>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">待审起售价</dt><dd className="mt-1 font-semibold">{amount(product.priceCents)}</dd></div><div><dt className="text-muted-foreground">运费 / 时效 / 采购成本</dt><dd className="mt-1">均未确认</dd></div><div><dt className="text-muted-foreground">商品标识</dt><dd className="mt-1 break-all font-mono text-xs">{product.slug}</dd></div></dl>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="mb-3 text-left text-xs leading-6 text-muted-foreground">以下规格名称与价格摘自原仓库资料，不是本站已验证的实验数量、年龄建议或供货承诺。</caption>
                  <thead className="border-b"><tr><th className="py-3 pr-4 font-semibold">原始规格</th><th className="whitespace-nowrap py-3 pr-4 font-semibold">待审售价</th><th className="whitespace-nowrap py-3 pr-4 font-semibold">可售库存</th><th className="whitespace-nowrap py-3 font-semibold">货源映射</th></tr></thead>
                  <tbody>{product.variants.map(variant => <tr key={variant.id} className="border-b last:border-0"><td className="min-w-56 py-4 pr-4 leading-6">{variant.name}</td><td className="py-4 pr-4">{amount(variant.priceCents)}</td><td className="py-4 pr-4">0</td><td className="whitespace-nowrap py-4 text-muted-foreground">未确认</td></tr>)}</tbody>
                </table>
              </div>
            </Surface>
          ))}
        </div>
        <Surface variant="subtle" className="mt-8 p-6 text-sm leading-7">
          <h2 className="text-panel-title">候选供货资料（仅管理员）</h2>
          <p className="mt-4">截图中出现的公司：{drafts.candidateSupplier.companyObserved}。主体身份、本站采购资格、代发条款及具体规格映射均未确认；未将此候选链接写成可执行的规格货源。</p>
          <a className="mt-2 inline-flex min-h-11 items-center break-all text-primary underline" href={drafts.candidateSupplier.url} target="_blank" rel="noreferrer">查看候选 1688 商品</a>
          <details className="mt-4"><summary className="cursor-pointer font-semibold">未采用素材及原因</summary><ul className="mt-3 list-disc space-y-3 pl-5 text-muted-foreground">{drafts.excludedAssets.map(group => <li key={group.files.join(',')}>{group.files.join('、')}：{group.reason}</li>)}</ul></details>
        </Surface>
      </AppStandardShell>
    </main>
  )
}
