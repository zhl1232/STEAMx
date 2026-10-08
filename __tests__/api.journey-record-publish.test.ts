import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/journeys/[id]/records/route'

const mocks = vi.hoisted(() => ({
  source: 'project',
  moderate: vi.fn(async () => ({state:'approved', modelName:'test'})),
  save: vi.fn(async () => ({id:11, record_kind:'progress', status:'pending', visibility:'public'})),
  queue: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({createClient: async () => ({})}))
vi.mock('@/lib/api/auth', () => ({requireAuth: async () => ({id:'a'}), handleApiError: (error: unknown) => {throw error}}))
vi.mock('@/lib/access/interaction-access', () => ({requireInteractionAccess: vi.fn()}))
vi.mock('@/lib/api/rate-limit', () => ({requireRateLimit: vi.fn()}))
vi.mock('@/lib/safety/server', () => ({moderateUserContent: mocks.moderate}))
vi.mock('@/lib/journeys/moderation', () => ({queueJourneyRecordModeration: mocks.queue}))
vi.mock('@/lib/journeys/service', () => ({
  getJourneyById: async () => ({id:7, user_id:'a', source_type:mocks.source}),
  upsertJourneyRecord: mocks.save,
  syncLegacyProjectRecord: vi.fn(), syncLegacyChallengeStage: vi.fn(), syncLegacyChallengeFinal: vi.fn(),
  touchJourney: vi.fn(), completeJourneyForApprovedFinal: vi.fn(), listJourneyRecords: vi.fn(),
}))
beforeEach(() => { vi.clearAllMocks(); mocks.source='project' })
function request(body: unknown) {
  return POST(new NextRequest('http://localhost/api/journeys/7/records', {
    method:'POST', body:JSON.stringify(body), headers:{'content-type':'application/json'},
  }), {params:Promise.resolve({id:'7'})})
}

it.each([
  {notes:'旧的私密保存', visibility:'private'},
  {notes:'  ', images:[]},
])('rejects obsolete private saving and empty project records: %j', async body => {
  expect((await request(body)).status).toBe(400)
  expect(mocks.save).not.toHaveBeenCalled()
})
it('routes text-only project publishing through moderation and returns pending', async () => {
  const response=await request({notes:'我的预测', images:[]})
  expect(response.status).toBe(201)
  expect((await response.json()).record.status).toBe('pending')
  expect(mocks.moderate).toHaveBeenCalledWith(expect.objectContaining({text:'我的预测',imageSources:[]}))
  expect(mocks.save).toHaveBeenCalledWith(expect.anything(),7,'a',expect.objectContaining({visibility:'public'}))
  expect(mocks.queue).toHaveBeenCalled()
})
it('keeps the shared challenge workspace draft contract', async () => {
  mocks.source='challenge'
  await request({notes:'阶段草稿', visibility:'private'})
  expect(mocks.moderate).not.toHaveBeenCalled()
  expect(mocks.save).toHaveBeenCalledWith(expect.anything(),7,'a',expect.objectContaining({visibility:'private'}))
})
