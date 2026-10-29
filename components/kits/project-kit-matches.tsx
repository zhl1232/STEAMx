import Link from 'next/link'
import { KIT_MATERIAL_NOTICE } from '@/lib/kits/types'
import type { getProjectKitMatches } from '@/lib/kits/service'
export function ProjectKitMatches({matches}:{matches:Awaited<ReturnType<typeof getProjectKitMatches>>}){
 if(!matches.length)return null
 return <section className="mt-5 space-y-4 border-t pt-4" aria-label="套装与自备材料"><h3 className="text-sm font-semibold">套装与自备材料</h3>{matches.map(m=><div key={m.kit.id} className="text-sm leading-6"><Link href={`/kits/${m.kit.slug}`} className="underline">{m.kit.name}</Link><p>{!m.confirmed?'同系列参考，配套关系待核对':m.preparationStatus==='extras'?`还需自备：${m.extras.join('、')}`:m.preparationStatus==='ready'?'按单次实验用量准备':'材料准备待核对'}</p>{m.offers.map(o=><Link className="block underline" key={o.id} href={`/store/products/${o.productId}?variant=${o.id}`}>查看对应规格{o.priceCents!=null?` · ¥${(o.priceCents/100).toFixed(2)}`:''}</Link>)}</div>)}<p className="text-xs leading-6 text-muted-foreground">{KIT_MATERIAL_NOTICE}</p></section>
}
