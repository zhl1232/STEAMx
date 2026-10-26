/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runGrowthReview } from './worker'
import { callRpc } from '@/lib/supabase/rpc'
import { evaluateGrowth } from './ai-review'
import { moderateUserContent } from '@/lib/safety/server'
vi.mock('@/lib/supabase/admin',()=>({supabaseAdmin:{}}))
vi.mock('@/lib/supabase/rpc',()=>({callRpc:vi.fn()}))
vi.mock('./ai-review',()=>({evaluateGrowth:vi.fn(),GROWTH_PROMPT_VERSION:'growth-v1'}))
vi.mock('@/lib/safety/server',()=>({moderateUserContent:vi.fn(),createModerationCase:vi.fn()}))
vi.mock('@/lib/api/validation',()=>({validateOwnedOrTrustedProjectImageUrl:vi.fn()}))
vi.mock('@/lib/logger',()=>({logger:{info:vi.fn(),error:vi.fn()}}))
const context={type:'project_comment',version:1,evidence:{author_id:'user',content:'具体问题'}}
const job={id:'job',lease:'lease',context}
const allow={decision:{safety:'allow',quality:'eligible',stages:['exchange'],reason_code:'question',reason:'具体问题'},model:'mock'}
beforeEach(()=>{vi.resetAllMocks();vi.mocked(callRpc).mockResolvedValueOnce({data:job as never,error:null}).mockResolvedValue({data:{xp_awarded:5},error:null});vi.mocked(evaluateGrowth).mockResolvedValue(allow as never)})
describe('controlled system worker',()=>{
 it('submits result only through leased service RPC',async()=>{await runGrowthReview();expect(callRpc).toHaveBeenLastCalledWith({},'finish_growth_ai_job',expect.objectContaining({p_job:'job',p_lease:'lease',p_decision:allow.decision}));expect(callRpc).not.toHaveBeenCalledWith(expect.anything(),'review_growth_reward',expect.anything())})
 it('records timeout without an award decision',async()=>{vi.mocked(evaluateGrowth).mockRejectedValue(new Error('timeout'));await runGrowthReview();expect(callRpc).toHaveBeenLastCalledWith({},'finish_growth_ai_job',expect.objectContaining({p_decision:null,p_error:expect.stringContaining('timeout')}))})
 it('leaves unresolved image safety pending, never lets text approve it',async()=>{vi.mocked(callRpc).mockReset().mockResolvedValueOnce({data:{...job,context:{...context,evidence:{...context.evidence,image_url:'https://safe-bucket/photo'}}} as never,error:null}).mockResolvedValue({data:{state:'retry_or_manual'},error:null});vi.mocked(moderateUserContent).mockResolvedValue({state:'pending'} as never);await runGrowthReview();expect(evaluateGrowth).not.toHaveBeenCalled();expect(callRpc).toHaveBeenLastCalledWith({},'finish_growth_ai_job',expect.objectContaining({p_decision:null,p_error:expect.stringContaining('image_safety_unresolved')}))})
 it('suppresses text model call for server-confirmed active duplicate',async()=>{vi.mocked(callRpc).mockReset().mockResolvedValueOnce({data:{...job,context:{...context,reviewed_duplicate:true}} as never,error:null}).mockResolvedValue({data:{xp_awarded:0},error:null});await runGrowthReview();expect(evaluateGrowth).not.toHaveBeenCalled();expect(callRpc).toHaveBeenLastCalledWith({},'finish_growth_ai_job',expect.objectContaining({p_decision:expect.objectContaining({quality:'ineligible',stages:[]})}))})
 it('records apply failure for retry rather than reporting paid XP',async()=>{vi.mocked(callRpc).mockReset().mockResolvedValueOnce({data:job as never,error:null}).mockResolvedValueOnce({data:null,error:{message:'stale'}} as never).mockResolvedValue({data:{state:'retry_or_manual'},error:null});await expect(runGrowthReview()).rejects.toEqual({message:'stale'});expect(callRpc).toHaveBeenLastCalledWith({},'finish_growth_ai_job',expect.objectContaining({p_decision:null,p_error:'apply_failed_or_eligibility_changed'}))})
})
