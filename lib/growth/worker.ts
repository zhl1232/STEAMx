import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import { evaluateGrowth, GROWTH_PROMPT_VERSION, type GrowthContext } from './ai-review'
import { createModerationCase, moderateUserContent } from '@/lib/safety/server'
import { validateOwnedOrTrustedProjectImageUrl } from '@/lib/api/validation'
import { logger } from '@/lib/logger'
import type { Json } from '@/lib/supabase/types'

export async function runGrowthReview() {
  if (!supabaseAdmin) return { state: 'unavailable' }
  const { data, error } = await callRpc(supabaseAdmin, 'claim_growth_ai_job', {})
  if (error) throw error
  if (!data) return { state: 'empty' }
  const job = data as unknown as { id: string; lease: string; context: GrowthContext }
  const usage: Parameters<typeof evaluateGrowth>[1] = []
  const started = Date.now()
  let decision: Json | null = null
  let model: string | null = null
  let failure: string | null = null
  try {
    const image = job.context.type === 'project_comment' ? job.context.evidence.image_url : null
    if (typeof image === 'string' && image) {
      validateOwnedOrTrustedProjectImageUrl(image, String(job.context.evidence.author_id), '问题图片', {bucket:'comment-images'})
      const safety = await moderateUserContent({imageSources:[image]})
      if (safety.state === 'pending') throw new Error('image_safety_unresolved')
      if (safety.state === 'rejected') decision = {safety:'reject',quality:'ineligible',stages:[],reason_code:'none',reason:safety.reason || 'Image rejected by safety review'}
    }
    if (!decision && job.context.reviewed_duplicate) decision = {safety:'allow',quality:'ineligible',stages:[],reason_code:'none',reason:'Exact normalized duplicate of previously approved active evidence; no new contribution'}
    if (!decision) {
      const result = await evaluateGrowth(job.context, usage)
      decision = result.decision as unknown as Json; model = result.model
    }
  } catch (error) {
    failure = error instanceof Error ? error.name + ':' + error.message.slice(0, 160) : 'growth_review_failed'
  }
  const meter = { attempts: usage, latencyMs: Date.now() - started, promptVersion: GROWTH_PROMPT_VERSION, estimatedCost: null, costNote: 'Text review tokens measured; existing image safety uses its own logging. Provider price not configured; admission limit is not a monetary budget.' }
  logger.info('growth_ai_review', { jobId: job.id, model, ...meter, failed: Boolean(failure) })
  const finished = await callRpc(supabaseAdmin, 'finish_growth_ai_job', { p_job: job.id, p_lease: job.lease, p_decision: decision, p_usage: meter as unknown as Json, p_model: model, p_error: failure })
  if (finished.error) {
    // Eligibility may change while the model runs. Save a bounded retry; never
    // claim payment or publish based only on a model's response.
    await callRpc(supabaseAdmin, 'finish_growth_ai_job', { p_job: job.id, p_lease: job.lease, p_decision: null, p_usage: meter as unknown as Json, p_model: model, p_error: 'apply_failed_or_eligibility_changed' })
    throw finished.error
  }
  const state = finished.data as {state?:string} | null
  const reviewed = decision as {safety?:string;reason?:string} | null
  if (!failure && !state?.state && reviewed && reviewed.safety !== 'allow') {
    await createModerationCase({contentType:job.context.type==='project_comment'?'comment':job.context.type==='comment'?'completion_comment':'completion',contentId:Number((data as {content_id?:number}).content_id),authorId:String(job.context.evidence.author_id || job.context.evidence.user_id),source:'automatic',status:reviewed.safety==='reject'?'rejected':'pending',riskLevel:reviewed.safety==='reject'?'high':'medium',reason:reviewed.reason?.slice(0,1000) || 'AI 发布安全需要复核',modelName:model})
  }
  return finished.data
}
export async function safelyRunGrowthReview() {
  try { return await runGrowthReview() } catch (error) { logger.error(error, { context: 'growth review worker' }); return { state: 'deferred' } }
}
