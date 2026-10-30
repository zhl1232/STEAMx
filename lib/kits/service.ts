import { canPreviewMissingKitTable, localPreviewKits } from './local-preview'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getProjectById } from '@/lib/api/explore-data'
import { isStoreCatalogVisible } from '@/lib/store/config'
import { isKitRelationConfirmed } from './review'
import { hasKitVisualMatch, hasVisualMatchEvidence } from './visual-match'
import type { ExperimentKit, KitProjectRelation } from './types'
// Dedicated tables are accessed only through server services with field whitelists.
export function kitDatabase(): SupabaseClient { if (!supabaseAdmin) throw new Error('套装服务暂不可用'); return supabaseAdmin as unknown as SupabaseClient }
const publicFields = 'id,slug,name,kind,revision,status,cover_url,gallery_urls,materials,catalog,preparation_note'
export async function listKits(): Promise<ExperimentKit[]> {
  const { data, error } = await kitDatabase().from('experiment_kits').select(publicFields).eq('status', 'published').order('kind').order('sort_order').order('slug')
  if (canPreviewMissingKitTable(error)) return localPreviewKits()
  if (error) throw error
  return data ?? []
}
export async function getKit(slug: string): Promise<ExperimentKit | null> {
  const { data, error } = await kitDatabase().from('experiment_kits').select(publicFields).eq('status', 'published').eq('slug', slug).maybeSingle()
  if (canPreviewMissingKitTable(error)) return (await localPreviewKits()).find(kit => kit.slug === slug) ?? null
  if (error) throw error
  return data
}
export async function getKitProjects(kit: ExperimentKit, page = 0) {
  if (process.env.NODE_ENV === 'development' && kit.localPreview) return { projects: [], hasMore: false }
  const { data, error } = await kitDatabase().from('experiment_kit_projects').select('kit_id,project_id,status,preparation_status,extras,project_hash,kit_revision,sort_order').eq('kit_id',kit.id).neq('status','excluded').order('status',{ascending:false}).order('sort_order').order('project_id').range(page*24,page*24+24)
  if(error) throw error
  const rows = data as KitProjectRelation[]
  const hydrated = await Promise.all(rows.slice(0,24).map(async relation => {
    const project = await getProjectById(relation.project_id)
    if(!project) return null
    const confirmed = isKitRelationConfirmed(kit,relation,project)
    return { project: { id:project.id,title:project.title,image:project.image }, confirmed,
      preparationStatus: confirmed ? relation.preparation_status : 'unknown', extras: confirmed ? relation.extras : [] }
  }))
  return { projects: hydrated.filter((x): x is NonNullable<typeof x> => x!==null), hasMore:rows.length>24 }
}
export async function getKitOffers(kit: ExperimentKit) {
  if (process.env.NODE_ENV === 'development' && kit.localPreview) return []
  if(!isStoreCatalogVisible()) return []
  const {data,error}=await kitDatabase().from('store_variant_kits').select('variant_id').eq('kit_id',kit.id).eq('kit_revision',kit.revision).eq('verified',true)
  if(error) throw error
  if(!data.length) return []
  const {data: variants,error: variantError}=await kitDatabase().from('store_product_variants').select('id,product_id,name,price_cents,product:store_products!inner(id,name,status,checkout_mode,shipping_cents)').in('id',data.map(x=>x.variant_id)).eq('status','active').eq('product.status','active').eq('product.checkout_mode','internal').not('product.shipping_cents','is',null)
  if(variantError) throw variantError
  return (variants??[]).map(v=>{
    const product = Array.isArray(v.product) ? v.product[0] : v.product
    return {id:v.id,productId:v.product_id,name:v.name,priceCents:v.price_cents,productName:product?.name as string | undefined}
  })
}
export async function getKitsForVariants(variantIds: string[], options: {includeDraft?: boolean} = {}): Promise<Record<string,ExperimentKit>> {
  if(options.includeDraft) {
    const [{requireRole},{createClient}]=await Promise.all([import('@/lib/api/auth'),import('@/lib/supabase/server')])
    await requireRole(await createClient(),['admin'])
  }
  if(!variantIds.length) return {}
  const {data,error}=await kitDatabase().from('store_variant_kits').select('variant_id,kit_id,kit_revision').in('variant_id',variantIds).eq('verified',true)
  if(error) throw error
  let kits: ExperimentKit[]
  if(options.includeDraft){const result=await kitDatabase().from('experiment_kits').select(publicFields).in('id',data.map(r=>r.kit_id));if(result.error)throw result.error;kits=result.data??[]}else{kits=await listKits()}
  const byId=new Map(kits.map(k=>[k.id,k]))
  return Object.fromEntries((data??[]).flatMap(r=>{const kit=byId.get(r.kit_id);return kit&&kit.revision===r.kit_revision?[[r.variant_id,kit]]:[]}))
}
export async function getProjectKitMatches(project: import('@/lib/mappers/types').Project, selectedSlug?: string) {
  try {
    const {data,error}=await kitDatabase().from('experiment_kit_projects').select('kit_id,project_id,status,preparation_status,extras,project_hash,kit_revision,sort_order,evidence').eq('project_id',Number(project.id)).neq('status','excluded')
    if(error)throw error
    const kits=await listKits();const byId=new Map(kits.map(k=>[k.id,k]))
    return (await Promise.all((data as KitProjectRelation[]).map(async relation=>{
      const kit=byId.get(relation.kit_id);if(!kit)return null
      const confirmed=isKitRelationConfirmed(kit,relation,project)
      const visualMatch=hasKitVisualMatch(kit,relation,project)
      if(hasVisualMatchEvidence(relation)&&!visualMatch&&!confirmed)return null
      const currentPack = kit.kind === 'material_pack' && relation.kit_revision === kit.revision
      const currentGeneral = kit.kind === 'general_materials' && relation.kit_revision === kit.revision
        && Boolean(project.title.trim()) && kit.catalog.includes(project.title.trim())
      if(!confirmed&&!currentPack&&!currentGeneral&&!visualMatch&&kit.slug!==selectedSlug)return null
      const canRecommend = confirmed && relation.preparation_status !== 'unknown'
      const availableOffers = canRecommend || currentPack || currentGeneral || visualMatch ? await getKitOffers(kit) : []
      return {linkedOffers: availableOffers,kit,confirmed,...(visualMatch ? {visualMatch:true} : {}),preparationStatus:confirmed?relation.preparation_status:'unknown',extras:confirmed?relation.extras:[],offers:canRecommend?availableOffers:[]}
    }))).filter((x):x is NonNullable<typeof x>=>x!==null)
  }catch{return []}
}
