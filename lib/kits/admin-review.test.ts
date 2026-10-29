import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({responses:[] as unknown[],upsert:vi.fn(),update:vi.fn(),project:vi.fn(),hash:vi.fn(),from:vi.fn()}))
vi.mock('@/lib/api/auth',()=>({requireRole:async()=>({user:{id:'admin'}}),handleApiError:(e:Error)=>Response.json({error:e.message},{status:500})}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({})}))
vi.mock('@/lib/store/access',()=>({requireSameOrigin:()=>{}}))
vi.mock('@/lib/kits/service',()=>({kitDatabase:()=>({from:mocks.from})}))
vi.mock('@/lib/api/explore-data',()=>({getProjectById:mocks.project}))
vi.mock('@/lib/kits/review',()=>({hashKitProjectContent:mocks.hash}))
vi.mock('@/lib/project/materials',()=>({resolveProjectMaterials:()=>({materials:['纸杯2个'],preparationNotes:['清水需自备']})}))
import { GET,POST } from '@/app/api/admin/kits/route'
const kitId='00000000-0000-4000-8000-000000000001'
const variantId='00000000-0000-4000-8000-000000000002'
const currentHash='a'.repeat(64),oldHash='b'.repeat(64)
const projectInput={action:'project',kitId,expectedRevision:1,projectId:7,status:'confirmed',preparationStatus:'ready',extras:[],evidence:'对照供应商目录',sortOrder:0,reviewedProjectHash:currentHash}
const send=(body:unknown)=>POST(new Request('https://example.com/api/admin/kits',{method:'POST',body:JSON.stringify(body)}))
beforeEach(()=>{
 mocks.responses=[];mocks.upsert.mockReset().mockResolvedValue({error:null});mocks.update.mockReset();mocks.hash.mockReset().mockReturnValue(currentHash);mocks.project.mockReset().mockResolvedValue({id:7,title:'纸杯电话',steps:[{title:'连接',description:'穿线'}],videoUrl:'https://example.com/current.mp4'})
 mocks.from.mockReset().mockImplementation(()=>{const q:Record<string,unknown>={};for(const key of ['select','eq','order'])q[key]=()=>q;q.single=()=>Promise.resolve(mocks.responses.shift());q.upsert=mocks.upsert;q.update=mocks.update;return q})
})
it('does not approve a kit revision the reviewer never saw',async()=>{mocks.responses.push({data:{revision:2},error:null});expect((await send(projectInput)).status).toBe(409);expect(mocks.upsert).not.toHaveBeenCalled();expect(mocks.project).not.toHaveBeenCalled()})
it('rejects confirmation if project instructions changed since the displayed snapshot',async()=>{mocks.responses.push({data:{revision:1},error:null});expect((await send({...projectInput,reviewedProjectHash:oldHash})).status).toBe(409);expect(mocks.upsert).not.toHaveBeenCalled()})
it('requires a displayed project snapshot before confirming a relationship',async()=>{mocks.responses.push({data:{revision:1},error:null});expect((await send({...projectInput,reviewedProjectHash:undefined})).status).toBe(409);expect(mocks.upsert).not.toHaveBeenCalled()})
it('saves candidates without silently approving their preparation or fresh instructions',async()=>{mocks.responses.push({data:{revision:1},error:null});expect((await send({...projectInput,status:'candidate',reviewedProjectHash:undefined})).status).toBe(200);expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({status:'candidate',preparation_status:'unknown',project_hash:null,kit_revision:1}))})
it('does not approve a stale SKU mapping with the latest kit revision',async()=>{mocks.responses.push({data:{revision:3},error:null});expect((await send({action:'variant',kitId,variantId,expectedRevision:1,verified:true,evidence:'核对供应商规格编号'})).status).toBe(409);expect(mocks.upsert).not.toHaveBeenCalled()})
it('returns effective preparation, instructions and evidence hash in a no-store review snapshot',async()=>{const response=await GET(new Request('https://example.com/api/admin/kits?projectId=7'));expect(response.headers.get('cache-control')).toBe('no-store');expect((await response.json()).snapshot).toEqual(expect.objectContaining({projectId:7,materials:['纸杯2个'],preparationNotes:['清水需自备'],steps:[{title:'连接',description:'穿线'}],reviewedProjectHash:currentHash}))})
