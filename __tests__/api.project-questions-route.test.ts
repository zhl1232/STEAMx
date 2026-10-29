/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/projects/[id]/questions/route'
import { requireAuth } from '@/lib/api/auth'
import { scheduleGrowthReview } from '@/lib/growth/schedule'
const mocks=vi.hoisted(()=>({from:vi.fn(),insert:vi.fn(),chains:[] as Record<string, ReturnType<typeof vi.fn>>[],responses:[] as unknown[]}))
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
 vi.clearAllMocks();mocks.responses=[];mocks.chains=[];vi.mocked(requireAuth).mockResolvedValue({id:'user'} as never)
 mocks.from.mockImplementation(()=>{const response=mocks.responses.shift();const chain:Record<string,unknown>={};for(const method of ['select','eq','or','is','not','in','gte','lt','order','limit','range'])chain[method]=vi.fn(()=>chain);mocks.chains.push(chain as Record<string, ReturnType<typeof vi.fn>>);chain.insert=(value:unknown)=>{mocks.insert(value);return chain};chain.single=chain.maybeSingle=()=>Promise.resolve(response);chain.then=(resolve:(x:unknown)=>void)=>Promise.resolve(response).then(resolve);return chain})
})
describe('project Q&A authenticated pending pipeline',()=>{
 it('ignores forged XP, quality and approval; schedules server review',async()=>{mocks.responses=[project,{data:[]},{data:{id:99,moderation_state:'pending'}}];const r=await post({content:'能用另一种电池吗？',moderation_state:'approved',quality:true,xp:999});expect(r.status).toBe(202);expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({author_id:'user',is_project_question:true,moderation_state:'pending'}));expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('xp');expect(scheduleGrowthReview).toHaveBeenCalledOnce()})
 it('rejects legacy or cross-project parent',async()=>{mocks.responses=[project,{data:{author_id:'other',project_id:8,moderation_state:'approved',is_project_question:true}}];expect((await post({content:'怎样接？',parent_id:5})).status).toBe(400);expect(mocks.insert).not.toHaveBeenCalled()})
 it('preserves login denial without writes',async()=>{vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'));expect((await post({content:'问题'})).status).toBeGreaterThanOrEqual(400);expect(mocks.insert).not.toHaveBeenCalled()})
 it('keeps classified/unpublished project unavailable',async()=>{mocks.responses=[{data:{...project.data,classification_status:'unreviewed'}}];expect((await post({content:'问题'})).status).toBe(404);expect(mocks.insert).not.toHaveBeenCalled()})
 it('rejects rapid exact repeats before model scheduling',async()=>{mocks.responses=[project,{data:[{id:9}]}];expect((await post({content:'same'})).status).toBe(409);expect(scheduleGrowthReview).not.toHaveBeenCalled()})
 it('paginates roots independently of replies',async()=>{mocks.responses=[project,{data:[{id:99,parent_id:null}]},{data:[{id:100,parent_id:99}]}];const r=await GET(new NextRequest('http://localhost/api/projects/7/questions'),params);expect(r.headers.get('cache-control')).toBe('private, no-store');expect((await r.json()).questions).toHaveLength(2)})
})

const getDiscussion = (suffix = '') => GET(new NextRequest(`http://localhost/api/projects/7/questions?includeLegacy=1${suffix}`), params)
const legacy = (id:number, parent_id:number|null=null) => ({id,parent_id,is_project_question:false,question_root_id:null,moderation_state:'approved',profiles:{display_name:`作者${id}`},content:`留言${id}`,created_at:'2026-10-01T10:00:00Z'})
describe('unified project discussion reads',()=>{
 it('paginates mixed roots together and keeps legacy identity and nested reply attribution',async()=>{
  const roots=[{...legacy(100),is_project_question:true},...Array.from({length:20},(_,i)=>legacy(99-i))]
  mocks.responses=[project,{data:roots},{data:[]},{data:[legacy(110,99)]},{data:[legacy(111,110)]},{data:[]}]
  const response=await getDiscussion('&before=120');const body=await response.json()
  expect(response.status).toBe(200)
  expect(body.nextBefore).toBe(81)
  expect(body.questions).toHaveLength(22)
  expect(body.questions.at(-1)).toMatchObject({id:111,parent_id:110,question_root_id:99,is_project_question:false,reply_to_username:'作者110',created_at:'2026-10-01T10:00:00Z'})
  expect(body.repliesTruncated).toBe(false)
  expect(mocks.chains[1].lt).toHaveBeenCalledWith('id',120)
  expect(mocks.chains[1].or).toHaveBeenCalledWith('is_project_question.eq.true,moderation_state.eq.approved')
  for (const chain of mocks.chains.slice(3)) {
   expect(chain.eq).toHaveBeenCalledWith('project_id',7)
   expect(chain.eq).toHaveBeenCalledWith('is_project_question',false)
   expect(chain.eq).toHaveBeenCalledWith('moderation_state','approved')
  }
  expect(mocks.insert).not.toHaveBeenCalled()
  expect(scheduleGrowthReview).not.toHaveBeenCalled()
 })
 it('keeps the default endpoint restricted to questions',async()=>{
  mocks.responses=[project,{data:[]}]
  expect((await GET(new NextRequest('http://localhost/api/projects/7/questions'),params)).status).toBe(200)
  expect(mocks.chains[1].eq).toHaveBeenCalledWith('is_project_question',true)
  expect(mocks.chains[1].or).not.toHaveBeenCalled()
 })
 it('reports a legacy read failure instead of pretending the discussion is empty',async()=>{
  mocks.responses=[project,{data:[legacy(1)]},{data:null,error:new Error('read failed')}]
  expect((await getDiscussion()).status).toBe(500)
 })
 it('caps replies and explicitly reports truncated legacy threads',async()=>{
  mocks.responses=[project,{data:[legacy(1)]},{data:Array.from({length:201},(_,i)=>legacy(i+2,1))}]
  const body=await (await getDiscussion()).json()
  expect(body.questions).toHaveLength(201)
  expect(body.repliesTruncated).toBe(true)
 })
 it('bounds deep legacy traversal and reports the depth limit',async()=>{
  mocks.responses=[project,{data:[legacy(1)]},...Array.from({length:20},(_,i)=>({data:[legacy(i+2,i+1)]}))]
  const body=await (await getDiscussion()).json()
  expect(body.questions).toHaveLength(21)
  expect(body.repliesTruncated).toBe(true)
  expect(body.questions.at(-1)).toMatchObject({id:21,question_root_id:1,reply_to_username:'作者20'})
 })
 it('shares the reply budget between new and legacy threads',async()=>{
  const questionRoot={...legacy(500),is_project_question:true,question_root_id:500}
  const replies=Array.from({length:199},(_,i)=>({...legacy(i+501,500),is_project_question:true,question_root_id:500}))
  mocks.responses=[project,{data:[questionRoot,legacy(1)]},{data:replies},{data:[legacy(2,1),legacy(3,1)]}]
  const body=await (await getDiscussion()).json()
  expect(body.questions).toHaveLength(202)
  expect(body.questions.at(-1)).toMatchObject({id:2,question_root_id:1,is_project_question:false})
  expect(body.repliesTruncated).toBe(true)
  expect(mocks.chains[3].limit).toHaveBeenCalledWith(2)
 })
 it('continues to reject replies to same-project legacy comments',async()=>{
  mocks.responses=[project,{data:{...legacy(1),author_id:'other',project_id:7}}]
  expect((await post({content:'新回复',parent_id:1})).status).toBe(400)
  expect(mocks.insert).not.toHaveBeenCalled()
 })
})
