import Link from 'next/link'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { AppWideShell } from '@/components/layout/app-shell'
import { listKits } from '@/lib/kits/service'
import { RecentKit } from '@/components/kits/recent-kit'
export const dynamic='force-dynamic'
export const metadata={title:'按套装找项目'}
export default async function KitsPage(){const kits=await listKits();return <AppWideShell className="py-8"><Link href="/explore" className="text-sm underline">返回探索</Link><h1 className="mt-6 text-2xl font-semibold">按套装找项目</h1><RecentKit/>{kits.some(kit => kit.localPreview) ? <p role="status" className="mt-4 rounded border p-3 text-sm text-muted-foreground">本地目录预览：项目关联及购买将在数据库迁移后启用。</p> : null}{(['material_pack','general_materials'] as const).map(kind=><section key={kind} className="mt-8"><h2 className="text-lg font-semibold">{kind==='material_pack'?'实验材料包':'通用材料套装'}</h2><div className="mt-4 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">{kits.filter(k=>k.kind===kind).map(kit=><Link key={kit.id} href={`/kits/${kit.slug}`} className="rounded-lg border p-3">{kit.cover_url?<OptimizedImage src={kit.cover_url} alt="" width={800} height={800} variant="grid" className="aspect-square w-full object-contain"/>:null}<h3 className="mt-3 text-sm">{kit.name}</h3></Link>)}</div></section>)}{!kits.length?<p className="py-10">套装目录正在整理。</p>:null}</AppWideShell>}
