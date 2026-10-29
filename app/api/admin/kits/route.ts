import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { requireSameOrigin } from '@/lib/store/access'
import { kitDatabase } from '@/lib/kits/service'
import { getProjectById } from '@/lib/api/explore-data'
import { resolveProjectMaterials } from '@/lib/project/materials'
import { hashKitProjectContent } from '@/lib/kits/review'
const lines = z.array(z.string().trim().min(1).max(2000)).max(1000)
const evidence = z.string().trim().min(1).max(4000)
const revision = z.number().int().positive()
const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('kit'), id: z.uuid(), editVersion: revision, name: z.string().trim().min(1).max(180), materials: lines, catalog: lines, preparation_note: z.string().max(4000), status: z.enum(['draft', 'published']) }),
  z.object({ action: z.literal('project'), kitId: z.uuid(), expectedRevision: revision, reviewedProjectHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), projectId: z.number().int().positive(), status: z.enum(['candidate', 'confirmed', 'excluded']), preparationStatus: z.enum(['unknown', 'ready', 'extras']), extras: lines, evidence, sortOrder: z.number().int().nonnegative() }),
  z.object({ action: z.literal('variant'), kitId: z.uuid(), expectedRevision: revision, variantId: z.uuid(), verified: z.boolean(), evidence }),
])
function conflict() { return NextResponse.json({ error: '核对内容已变化，请重新载入套装和项目资料后核对' }, { status: 409 }) }
export async function GET(request?: Request) {
  try {
    await requireRole(await createClient(), ['admin'])
    const projectId = request ? new URL(request.url).searchParams.get('projectId') : null
    if (projectId !== null) {
      const id = Number(projectId)
      if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: '项目编号无效' }, { status: 422 })
      const project = await getProjectById(id)
      if (!project) return NextResponse.json({ error: '项目不存在或未公开' }, { status: 404 })
      return NextResponse.json({ snapshot: { projectId: id, title: project.title, ...resolveProjectMaterials(project), steps: project.steps ?? [], videoUrl: project.videoUrl ?? null, reviewedProjectHash: hashKitProjectContent(project) } }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const { data, error } = await kitDatabase().from('experiment_kits').select('*').order('sort_order')
    if (error) throw error
    return NextResponse.json({ kits: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return handleApiError(e) }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    await requireRole(await createClient(), ['admin'])
    const parsed = input.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })
    const value = parsed.data
    const db = kitDatabase()
    if (value.action === 'kit') {
      const { action, id, editVersion, ...patch } = value
      void action
      const { data, error } = await db.from('experiment_kits').update(patch).eq('id', id).eq('edit_version', editVersion).select('id').maybeSingle()
      if (error) throw error
      if (!data) return conflict()
    } else {
      const { data: kit, error } = await db.from('experiment_kits').select('revision').eq('id', value.kitId).single()
      if (error) throw error
      if (kit.revision !== value.expectedRevision) return conflict()
      if (value.action === 'project') {
        const project = await getProjectById(value.projectId)
        if (!project) return NextResponse.json({ error: '项目不存在或未公开' }, { status: 422 })
        const hash = hashKitProjectContent(project)
        if (value.status === 'confirmed' && value.reviewedProjectHash !== hash) return conflict()
        if (value.preparationStatus === 'extras' && !value.extras.length) return NextResponse.json({ error: '请填写自备材料' }, { status: 422 })
        const { error: saveError } = await db.from('experiment_kit_projects').upsert({ kit_id: value.kitId, project_id: value.projectId, status: value.status, preparation_status: value.status === 'confirmed' ? value.preparationStatus : 'unknown', extras: value.extras, evidence: { note: value.evidence }, project_hash: value.status === 'confirmed' ? value.reviewedProjectHash : null, kit_revision: value.expectedRevision, sort_order: value.sortOrder })
        if (saveError) throw saveError
      } else {
        const { error: saveError } = await db.from('store_variant_kits').upsert({ variant_id: value.variantId, kit_id: value.kitId, kit_revision: value.expectedRevision, verified: value.verified, evidence: { note: value.evidence } })
        if (saveError) throw saveError
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) { return handleApiError(e) }
}
