/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/projects/[id]/questions/route'
import { requireAuth } from '@/lib/api/auth'
import { scheduleGrowthReview } from '@/lib/growth/schedule'
const mocks=vi.hoisted(()=>({from:vi.fn(),insert:vi.fn(),responses:[] as unknown[]}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:mocks.from})}))
vi.mock('@/lib/api/auth',async original=>({...await original<typeof import('@/lib/api/auth')>(),requireAuth:vi.fn(async()=>({id:'user'}))}))
vi.mock('@/lib/access/interaction-access',()=>({requireInteractionAccess:vi.fn()}))
vi.mock('@/lib/api/rate-limit',()=>({requireRateLimit:vi.fn()}))
vi.mock('@/lib/api/validation',async original=>({...await original<typeof import('@/lib/api/validation')>(),validateOwnedOrTrustedProjectImageUrl:vi.fn(),validateContentSafe:vi.fn()}))
vi.mock('@/lib/safety/server',()=>({moderateUserContent:vi.fn(async()=>({state:'approved'})),assertUsersNotBlocked:vi.fn()}))
vi.mock('@/lib/content-classification',()=>({getContentClassificationSettings:async()=>({enforcementEnabled:true})}))
vi.mock('@/lib/growth/schedule',()=>({scheduleGrowthReview:vi.fn()}))
const params={params:Promise.resolve({id:'7'})}
const project={data:{id:7,author_id:'author',status:'approved',moderation_state:'approved',classification_status:'reviewed'},error:null}
const post=(body:unknown)=>POST(new NextRequest('http://localhost/api/projects/7/questions',{method:'POST',body:JSON.stringify(body)}),params)
beforeEach(()=>{
 vi.clearAllMocks();mocks.responses=[];vi.mocked(requireAuth).mockResolvedValue({id:'user'} as never)
 mocks.from.mockImplementation(()=>{const response=mocks.responses.shift();const chain:Record<string,unknown>={};for(const method of ['select','eq','is','not','in','gte','lt','order','limit','range'])chain[method]=vi.fn(()=>chain);chain.insert=(value:unknown)=>{mocks.insert(value);return chain};chain.single=chain.maybeSingle=()=>Promise.resolve(response);chain.then=(resolve:(x:unknown)=>void)=>Promise.resolve(response).then(resolve);return chain})
})
describe('project Q&A authenticated pending pipeline',()=>{
 it('ignores forged XP, quality and approval; schedules server review',async()=>{mocks.responses=[project,{data:[]},{data:{id:99,moderation_state:'pending'}}];const r=await post({content:'能用另一种电池吗？',moderation_state:'approved',quality:true,xp:999});expect(r.status).toBe(202);expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({author_id:'user',is_project_question:true,moderation_state:'pending'}));expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('xp');expect(scheduleGrowthReview).toHaveBeenCalledOnce()})
 it('rejects legacy or cross-project parent',async()=>{mocks.responses=[project,{data:{author_id:'other',project_id:8,moderation_state:'approved',is_project_question:true}}];expect((await post({content:'怎样接？',parent_id:5})).status).toBe(400);expect(mocks.insert).not.toHaveBeenCalled()})
 it('preserves login denial without writes',async()=>{vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'));expect((await post({content:'问题'})).status).toBeGreaterThanOrEqual(400);expect(mocks.insert).not.toHaveBeenCalled()})
 it('keeps classified/unpublished project unavailable',async()=>{mocks.responses=[{data:{...project.data,classification_status:'unreviewed'}}];expect((await post({content:'问题'})).status).toBe(404);expect(mocks.insert).not.toHaveBeenCalled()})
 it('rejects rapid exact repeats before model scheduling',async()=>{mocks.responses=[project,{data:[{id:9}]}];expect((await post({content:'same'})).status).toBe(409);expect(scheduleGrowthReview).not.toHaveBeenCalled()})
 it('paginates roots independently of replies',async()=>{mocks.responses=[project,{data:[{id:99,parent_id:null}]},{data:[{id:100,parent_id:99}]}];const r=await GET(new NextRequest('http://localhost/api/projects/7/questions'),params);expect(r.headers.get('cache-control')).toBe('private, no-store');expect((await r.json()).questions).toHaveLength(2)})
})
