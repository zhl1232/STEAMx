import {beforeEach,expect,it,vi} from 'vitest'
const access=vi.hoisted(()=>({role:vi.fn(),origin:vi.fn(),db:vi.fn()}))
vi.mock('@/lib/api/auth',()=>({requireRole:access.role,handleApiError:(error:Error)=>Response.json({error:error.message},{status:error.message==='cross-origin'?403:401})}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({})}))
vi.mock('@/lib/store/access',()=>({requireSameOrigin:access.origin}))
vi.mock('@/lib/kits/service',()=>({kitDatabase:access.db}))
vi.mock('@/lib/api/explore-data',()=>({getProjectById:vi.fn()}))
vi.mock('@/lib/kits/review',()=>({hashKitProjectContent:vi.fn()}))
import {GET,POST} from '@/app/api/admin/kits/route'
beforeEach(()=>{access.role.mockReset();access.origin.mockReset();access.db.mockReset()})
it('does not read private kit evidence for a caller without admin access',async()=>{access.role.mockRejectedValue(new Error('admin required'));expect((await GET()).status).toBe(401);expect(access.db).not.toHaveBeenCalled()})
it('rejects cross-origin writes before reading or changing any kit data',async()=>{access.origin.mockImplementation(()=>{throw new Error('cross-origin')});const result=await POST(new Request('https://example.com/api/admin/kits',{method:'POST',body:'{}'}));expect(result.status).toBe(403);expect(access.role).not.toHaveBeenCalled();expect(access.db).not.toHaveBeenCalled()})
it('does not mutate data when an authenticated user lacks the admin role',async()=>{access.role.mockRejectedValue(new Error('admin required'));const result=await POST(new Request('https://example.com/api/admin/kits',{method:'POST',body:'{}'}));expect(result.status).toBe(401);expect(access.db).not.toHaveBeenCalled()})
