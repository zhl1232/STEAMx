import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppWideShell } from '@/components/layout/app-shell'
import { getKit,getKitProjects,getKitOffers } from '@/lib/kits/service'
import { KIT_MATERIAL_NOTICE } from '@/lib/kits/types'
import { RecentKit } from '@/components/kits/recent-kit'
export const dynamic='force-dynamic'
export default async function KitPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{page?:string}>}){
 const kit=await getKit((await params).slug);if(!kit)notFound()
 const raw=Number((await searchParams).page??0);const page=Number.isSafeInteger(raw)&&raw>=0?raw:0
 const [{projects,hasMore},offers]=await Promise.all([getKitProjects(kit,page),getKitOffers(kit)])
 return <AppWideShell className="py-8"><Link href="/kits" className="text-sm underline">选择其他套装</Link><RecentKit slug={kit.slug} name={kit.name}/><h1 className="my-6 text-2xl font-semibold">{kit.name}</h1>{kit.localPreview ? <p role="status" className="mb-4 rounded border p-3 text-sm text-muted-foreground">本地目录预览：项目关联及购买将在数据库迁移后启用。</p> : null}<p className="max-w-3xl whitespace-pre-line text-sm leading-7 text-muted-foreground">{kit.preparation_note || (kit.kind === 'general_materials' ? KIT_MATERIAL_NOTICE : '按目录内实验配套准备材料，日常材料按项目要求自备。')}</p>{kit.gallery_urls.length?<details className="mt-6"><summary>套装图片与目录原图</summary><div className="mt-4 max-w-3xl space-y-4">{kit.gallery_urls.map((url,i)=><img key={i} src={url} alt={`${kit.name}详情图${i+1}`} loading="lazy" className="h-auto w-full"/>)}</div></details>:null}{kit.materials.length?<details className="mt-6"><summary>套装材料清单</summary><ul className="mt-3 grid gap-2 sm:grid-cols-2">{kit.materials.map((m,i)=><li key={i}>{m}</li>)}</ul></details>:null}
 {kit.catalog.length ? <details className="mt-6"><summary>实验目录</summary><ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{kit.catalog.map((name,i)=><li key={i}>{name}</li>)}</ul></details> : null}
 {([true,false] as const).map(confirmed=><section key={String(confirmed)} className="mt-8"><h2 className="text-lg font-semibold">{confirmed?'配套实验':'同系列待核对'}（本页 {projects.filter(p=>p.confirmed===confirmed).length} 项）</h2>{!confirmed?<p className="mt-2 text-sm text-muted-foreground">以下项目尚未确认适配这个规格，请先核对项目材料与步骤。</p>:null}<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.filter(p=>p.confirmed===confirmed).map(p=><Link key={p.project.id} href={`/project/${p.project.id}?kit=${kit.slug}`} className="rounded-lg border p-4"><h3>{p.project.title}</h3><p className="mt-2 text-sm text-muted-foreground">{p.preparationStatus==='extras'?`还需自备：${p.extras.join('、')}`:p.preparationStatus==='ready'?'按单次实验要求核对材料':'材料准备待核对'}</p></Link>)}</div></section>)}
 {!projects.length?<p className="my-8">这个套装的站内教程正在核对。</p>:null}<nav className="my-6 flex gap-6">{page>0?<Link href={`/kits/${kit.slug}?page=${page-1}`}>上一页</Link>:null}{hasMore?<Link href={`/kits/${kit.slug}?page=${page+1}`}>下一页</Link>:null}</nav>
 {offers.length?<section className="mt-8 border-t pt-5"><h2 className="font-semibold">对应商品规格</h2>{offers.map(o=><Link key={o.id} className="mt-3 block underline" href={`/store/products/${o.productId}?variant=${o.id}`}>{o.name}</Link>)}</section>:null}</AppWideShell>
}
