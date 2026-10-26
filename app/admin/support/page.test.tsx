import { beforeEach, expect, it, vi } from 'vitest'
import AdminSupportPage from './page'
const mocks=vi.hoisted(()=>({redirect:vi.fn((destination:string):never=>{throw new Error(destination)})}))
vi.mock('next/navigation',()=>({redirect:mocks.redirect}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({})}))
vi.mock('@/lib/api/auth',()=>({requireRole:async()=>{throw new Error('not authenticated')}}))
vi.mock('@/components/support/support-inbox',()=>({SupportInbox:()=>null}))
beforeEach(()=>vi.clearAllMocks())
it('retains the authorized deep-link destination after logging in',async()=>{
 const conversation='12345678-1234-4123-8123-123456789abc'
 await expect(AdminSupportPage({searchParams:Promise.resolve({conversation,channel:'store'})})).rejects.toThrow('/login?next=')
 const login=new URL(mocks.redirect.mock.calls[0][0],'https://example.test')
 expect(login.searchParams.get('next')).toBe(`/admin/support?channel=store&conversation=${conversation}`)
})
it('drops invalid and unrelated parameters from the login destination',async()=>{
 await expect(AdminSupportPage({searchParams:Promise.resolve({conversation:'https://evil.example',channel:['store','platform'],next:'https://evil.example'})})).rejects.toThrow('/login?next=')
 const login=new URL(mocks.redirect.mock.calls[0][0],'https://example.test')
 expect(login.searchParams.get('next')).toBe('/admin/support')
})
