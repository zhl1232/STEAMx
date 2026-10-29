import {beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({responses:[] as unknown[], from:vi.fn(), project:vi.fn(), visible:true,role:vi.fn()}))
vi.mock('@/lib/api/auth',()=>({requireRole:mocks.role}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({})}))
vi.mock('@/lib/supabase/admin',()=>({supabaseAdmin:{from:mocks.from}}))
vi.mock('@/lib/api/explore-data',()=>({getProjectById:mocks.project}))
vi.mock('@/lib/store/config',()=>({isStoreCatalogVisible:()=>mocks.visible}))
vi.mock('./review',()=>({isKitRelationConfirmed:(_k:unknown,r:{status:string;kit_revision:number;project_hash:string})=>r.status==='confirmed'&&r.kit_revision===2&&r.project_hash==='current'}))
import {getProjectKitMatches,getKitsForVariants,getKitProjects} from './service'
const kit={id:'k1',slug:'one',revision:2,status:'published'}
const project={id:7,title:'纸杯电话',image:'/image.jpg'} as never
function respond(data:unknown){mocks.responses.push({data,error:null})}
beforeEach(()=>{mocks.responses=[];mocks.visible=true;mocks.role.mockReset().mockResolvedValue({user:{id:'admin'}});mocks.project.mockResolvedValue(project);mocks.from.mockReset().mockImplementation(()=>{const query:Record<string,unknown>={};for(const m of ['select','eq','neq','order','range','in','not'])query[m]=()=>query;query.then=(resolve:(v:unknown)=>unknown)=>Promise.resolve(mocks.responses.shift()).then(resolve);return query})})
it('candidate project is visible only in selected-kit context and has no offer',async()=>{const r={kit_id:'k1',project_id:7,status:'candidate',preparation_status:'ready',kit_revision:2,project_hash:'current'};respond([r]);respond([kit]);expect(await getProjectKitMatches(project)).toEqual([]);respond([r]);respond([kit]);const [match]=await getProjectKitMatches(project,'one');expect(match.confirmed).toBe(false);expect(match.preparationStatus).toBe('unknown');expect(match.offers).toEqual([]);expect(mocks.from).toHaveBeenCalledTimes(4)})
it('confirmed directory with unknown preparation cannot recommend purchasing',async()=>{respond([{kit_id:'k1',project_id:7,status:'confirmed',preparation_status:'unknown',kit_revision:2,project_hash:'current',extras:[]}]);respond([kit]);const [match]=await getProjectKitMatches(project);expect(match.confirmed).toBe(true);expect(match.offers).toEqual([]);expect(mocks.from).toHaveBeenCalledTimes(2)})
it('stale kit revision does not expose SKU-linked kit information',async()=>{respond([{variant_id:'v1',kit_id:'k1',kit_revision:1}]);respond([kit]);expect(await getKitsForVariants(['v1'])).toEqual({})})
it('unpublished or inaccessible projects are omitted even with an existing kit relation',async()=>{respond([{project_id:7,status:'candidate'}]);mocks.project.mockResolvedValue(null);const result=await getKitProjects(kit as never);expect(result.projects).toEqual([])})

it('requires administrator access before loading draft kit data',async()=>{mocks.role.mockRejectedValue(new Error('admin required'));await expect(getKitsForVariants(['v1'],{includeDraft:true})).rejects.toThrow('admin required');expect(mocks.from).not.toHaveBeenCalled()})
it('allows an authorized preview of a verified draft kit while preserving revision checks',async()=>{respond([{variant_id:'v1',kit_id:'k1',kit_revision:2}]);respond([{...kit,status:'draft'}]);expect(await getKitsForVariants(['v1'],{includeDraft:true})).toMatchObject({v1:{status:'draft'}});expect(mocks.role).toHaveBeenCalledWith({},['admin'])})
