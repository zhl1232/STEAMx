import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ existing: vi.fn(), exchange: vi.fn(), checkout: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({ requireAuth: async () => ({id:'user'}), handleApiError: (error: Error) => new Response(JSON.stringify({error:error.message}),{status:400}) }))
vi.mock('@/lib/supabase/server', () => ({createClient: async () => ({})}))
vi.mock('@/lib/store/access', () => ({requireSameOrigin:vi.fn()}))
vi.mock('@/lib/store/config', () => ({isStoreCheckoutEnabled:mocks.checkout,isStorePaymentEnabled:()=>true}))
vi.mock('@/lib/api/rate-limit', () => ({requireRateLimit:mocks.limit}))
vi.mock('@/lib/store/native', () => ({getCouponExchange:mocks.existing,exchangeCoupon:mocks.exchange}))
import { POST } from './route'
const offerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const request = () => new NextRequest('https://example.com/api/coins/coupon-exchanges',{method:'POST',body:JSON.stringify({offerId,expectedVersion:'version',idempotencyKey:'intent'})})
beforeEach(()=>{vi.clearAllMocks();mocks.checkout.mockReturnValue(false);mocks.existing.mockResolvedValue(null)})
it('recovers a completed intent before the store-closed gate and rate limit',async()=>{
 mocks.existing.mockResolvedValue({id:'exchange',offer_id:offerId})
 const response=await POST(request())
 expect(response.status).toBe(200)
 expect(await response.json()).toEqual({exchange:{id:'exchange',offer_id:offerId}})
 expect(mocks.exchange).not.toHaveBeenCalled()
 expect(mocks.limit).not.toHaveBeenCalled()
})
it('rejects a new exchange while checkout is closed',async()=>{
 expect((await POST(request())).status).toBe(400)
 expect(mocks.exchange).not.toHaveBeenCalled()
})
it('cannot reuse an intent for another offer',async()=>{
 mocks.existing.mockResolvedValue({id:'exchange',offer_id:'other'})
 expect((await POST(request())).status).toBe(400)
 expect(mocks.exchange).not.toHaveBeenCalled()
})
