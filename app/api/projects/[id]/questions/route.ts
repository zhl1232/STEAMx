import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateNumber, validateContentSafe, validateOwnedOrTrustedProjectImageUrl } from '@/lib/api/validation'
import { moderateUserContent, assertUsersNotBlocked } from '@/lib/safety/server'
import { getContentClassificationSettings } from '@/lib/content-classification'
import { scheduleGrowthReview } from '@/lib/growth/schedule'

const SELECT = 'id,project_id,author_id,content,parent_id,reply_to_user_id,reply_to_username,image_url,created_at,moderation_state,question_root_id,question_context,profiles:author_id(display_name,avatar_url)'
async function loadProject(client: Awaited<ReturnType<typeof createClient>>, id: number) {
  const { data, error } = await client.from('projects').select('id,author_id,status,moderation_state,classification_status').eq('id', id).maybeSingle()
  if (error) throw error
  const settings = await getContentClassificationSettings()
  if (!data || data.status !== 'approved' || data.moderation_state !== 'approved' || (settings.enforcementEnabled && data.classification_status !== 'reviewed')) return null
  return data
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await createClient()
    const id = validateNumber((await params).id, 'project id', { min: 1, integer: true })
    if (!await loadProject(client, id)) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const before = request.nextUrl.searchParams.get('before')
    let query = client.from('comments').select(SELECT).eq('project_id', id).eq('is_project_question', true).is('parent_id', null).order('id', { ascending: false }).limit(21)
    if (before) query = query.lt('id', validateNumber(before, 'before', { min: 1, integer: true }))
    const { data, error } = await query
    if (error) throw error
    const roots = (data || []).slice(0, 20)
    const { data: replies, error: replyError } = roots.length ? await client.from('comments').select(SELECT).eq('project_id', id).eq('is_project_question', true).in('question_root_id', roots.map(r => r.id)).not('parent_id', 'is', null).order('id').limit(201) : {data: [], error: null}
    if (replyError) throw replyError
    return NextResponse.json({ questions: [...roots, ...(replies || []).slice(0,200)], repliesTruncated: (replies?.length || 0) > 200, nextBefore: (data?.length || 0) > 20 ? roots.at(-1)?.id : null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return handleApiError(error) }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await createClient()
    const user = await requireAuth(client)
    await requireInteractionAccess(client, user, 'comment')
    await requireRateLimit(client, { key: 'project-questions', limit: 10, windowMs: 60_000 })
    const id = validateNumber((await params).id, 'project id', { min: 1, integer: true })
    const project = await loadProject(client, id)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (project.author_id) await assertUsersNotBlocked(client, user.id, project.author_id)
    const body = await request.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content || content.length > 2000) return NextResponse.json({ error: '请输入问题或回复（最多2000字）' }, { status: 400 })
    validateContentSafe(content, '问题与回复')
    const parentId = body.parent_id == null ? null : validateNumber(body.parent_id, 'parent id', { min: 1, integer: true })
    let replyId: string | null = null; let replyName: string | null = null
    if (parentId) {
      const { data: parent, error } = await client.from('comments').select('author_id,project_id,moderation_state,is_project_question,profiles:author_id(display_name)').eq('id', parentId).maybeSingle()
      if (error) throw error
      if (!parent || parent.project_id !== id || parent.moderation_state !== 'approved' || !parent.is_project_question) return NextResponse.json({ error: '回复对象不存在或尚未公开' }, { status: 400 })
      replyId = parent.author_id; replyName = (parent.profiles as unknown as { display_name: string } | null)?.display_name || null
      await assertUsersNotBlocked(client, user.id, replyId)
    }
    // Only structural context supplied by the page. Never accept a claimed reward.
    const area = ['materials', 'step', 'general'].includes(body.context?.area) ? body.context.area : 'general'
    const context: { area: string; step?: number; title?: string } = { area }
    if (area === 'step') {
      const stepNumber = validateNumber(body.context?.step, 'step', { min: 1, max: 100, integer: true })
      const { data: steps, error } = await client.from('project_steps').select('title').eq('project_id', id).order('sort_order', { ascending: true }).order('id', { ascending: true }).range(stepNumber - 1, stepNumber - 1)
      if (error) throw error
      if (!steps?.[0]) return NextResponse.json({ error: '步骤不存在' }, { status: 400 })
      context.step = stepNumber; context.title = steps[0].title
    }
    const imageUrl = typeof body.image_url === 'string' ? body.image_url : null
    validateOwnedOrTrustedProjectImageUrl(imageUrl, user.id, '问题图片', { bucket: 'comment-images' })
    const moderation = await moderateUserContent({ text: content })
    if (moderation.state === 'rejected') return NextResponse.json({ error: moderation.reason || '内容需要修改' }, { status: 422 })
    // Exact rapid repeats are a frequency rule, not a semantic quality classifier.
    const { data: repeated, error: duplicateError } = await client.from('comments').select('id').eq('author_id', user.id).eq('content', content).gte('created_at', new Date(Date.now() - 60_000).toISOString()).limit(1)
    if (duplicateError) throw duplicateError
    if (repeated?.length) return NextResponse.json({ error: '相同内容刚刚已提交，请勿重复发送' }, { status: 409 })
    const { data, error } = await client.from('comments').insert({ project_id: id, author_id: user.id, content, parent_id: parentId, reply_to_user_id: replyId, reply_to_username: replyName, image_url: imageUrl, is_project_question: true, question_context: context, moderation_state: 'pending' } as never).select(SELECT).single()
    if (error) throw error
    scheduleGrowthReview()
    return NextResponse.json({ question: data, moderation: { state: 'pending' } }, { status: 202 })
  } catch (error) { return handleApiError(error) }
}
