import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleApiError, requireRole } from '@/lib/api/auth'
import { callRpc } from '@/lib/supabase/rpc'
import { createModerationCase } from '@/lib/safety/server'
import { validateEnum, validateNumber } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const client = await createClient()
  try {
    await requireRole(client, ['moderator', 'admin'])
    if (request.nextUrl.searchParams.get('queue') === 'manual') {
      const {data,error} = await callRpc(client,'growth_manual_jobs',{})
      if(error) throw error
      return NextResponse.json({jobs:data},{headers:{'Cache-Control':'private, no-store'}})
    }
    const type = validateEnum(request.nextUrl.searchParams.get('type'), 'type', ['completion', 'comment', 'project_comment'] as const)
    const before = request.nextUrl.searchParams.get('before')
    const { data, error } = await callRpc(client, 'growth_review_queue', {
      p_type: type, p_before: before ? validateNumber(before, 'before', { min: 1, integer: true }) : null,
    })
    if (error) throw error
    return NextResponse.json({ items: data }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  const client = await createClient()
  try {
    await requireRole(client, ['moderator', 'admin'])
    const body = await request.json()
    if (body.action === 'safety_case') {
      const {data,error} = await callRpc(client,'growth_manual_jobs',{})
      if(error) throw error
      const job = (data as unknown as {id:string;content_type:string;content_id:number;user_id:string}[]).find(j=>j.id===body.jobId)
      if(!job) return NextResponse.json({error:'待复核任务不存在'},{status:404})
      await createModerationCase({contentType:job.content_type==='project_comment'?'comment':job.content_type==='comment'?'completion_comment':'completion',contentId:job.content_id,authorId:job.user_id,source:'admin',riskLevel:'medium',reason:'成长AI审核未完成，请核对发布安全；奖励资格另行复核'})
      return NextResponse.json({ok:true})
    }
    const type = validateEnum(body.type, 'type', ['completion', 'comment', 'project_comment'] as const)
    const id = validateNumber(body.id, 'id', { min: 1, integer: true })
    const allowed = type === 'completion' ? ['process', 'discovery', 'final', 'skip'] : ['exchange', 'skip']
    if (!Array.isArray(body.stages) || body.stages.length < 1 || body.stages.length > 3 ||
        body.stages.some((stage: unknown) => typeof stage !== 'string' || !allowed.includes(stage)) ||
        new Set(body.stages).size !== body.stages.length ||
        (body.stages.includes('skip') && body.stages.length !== 1) ||
        typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000 ||
        typeof body.hash !== 'string' || !/^[a-f0-9]{32}$/.test(body.hash)) {
      return NextResponse.json({ error: '请选择审核阶段并填写真实内容依据；内容更新后请重新加载' }, { status: 400 })
    }
    const { data, error } = await callRpc(client, 'review_growth_reward', {
      p_type: type, p_id: id, p_stages: body.stages, p_hash: body.hash, p_reason: body.reason.trim(),
    })
    if (error) throw error
    return NextResponse.json({ result: data })
  } catch (error) { return handleApiError(error) }
}
