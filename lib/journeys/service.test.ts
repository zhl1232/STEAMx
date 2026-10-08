import { describe, expect, it, vi } from 'vitest'

import {
  completeJourneyForApprovedFinal,
  listJourneyRecords,
  publishJourneyRecord,
  reopenJourneyAfterRejectedRecord,
  upsertJourneyRecord,
} from '@/lib/journeys/service'
import type { Journey, JourneyRecord } from '@/lib/journeys/types'

type QueryResponse = { data?: unknown; error?: unknown }

function createFakeClient(responses: QueryResponse[]) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const from = vi.fn((table: string) => {
    const response = responses.shift() ?? { data: null, error: null }
    const builder = {
      select: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'select', args })
        return builder
      }),
      insert: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'insert', args })
        return builder
      }),
      update: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'update', args })
        return builder
      }),
      eq: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'eq', args })
        return builder
      }),
      order: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'order', args })
        return builder
      }),
      limit: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: 'limit', args })
        return builder
      }),
      maybeSingle: vi.fn(async () => response),
      single: vi.fn(async () => response),
      then: (resolve: (value: QueryResponse) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(response).then(resolve, reject),
    }
    return builder
  })

  return { client: { from } as never, calls }
}

const journey: Journey = {
  id: 7,
  user_id: 'user-1',
  source_type: 'project',
  project_id: 42,
  challenge_id: null,
  title: '纸板桥',
  project_goal: null,
  attempt_no: 1,
  status: 'active',
  started_at: '2026-08-19T08:00:00.000Z',
  last_activity_at: '2026-08-19T08:00:00.000Z',
  completed_at: null,
  created_at: '2026-08-19T08:00:00.000Z',
  updated_at: '2026-08-19T08:00:00.000Z',
  sourceId: 42,
}

function record(overrides: Partial<JourneyRecord> = {}): JourneyRecord {
  return {
    id: 11,
    journey_id: journey.id,
    user_id: journey.user_id,
    record_kind: 'progress',
    anchor_type: 'extra',
    anchor_index: null,
    title: null,
    notes: '第一次测试',
    images: [],
    image_captions: null,
    video_url: null,
    data: null,
    visibility: 'private',
    status: 'draft',
    moderation_state: 'approved',
    moderation_source: 'private_draft',
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
    published_at: null,
    legacy_source: null,
    legacy_source_id: null,
    created_at: '2026-08-19T08:01:00.000Z',
    updated_at: '2026-08-19T08:01:00.000Z',
    ...overrides,
  }
}

describe('Journey service', () => {
  it('stores a private progress record as a draft without public moderation', async () => {
    const inserted = record()
    const fake = createFakeClient([
      { data: journey, error: null },
      { data: inserted, error: null },
      { data: null, error: null },
      { data: { id: 50 }, error: null },
      { data: null, error: null },
    ])

    const result = await upsertJourneyRecord(fake.client, journey.id, journey.user_id, {
      recordKind: 'progress',
      notes: '第一次测试',
      images: [],
      visibility: 'private',
    })

    expect(result).toMatchObject({ status: 'draft', visibility: 'private', moderation_state: 'approved' })
    expect(fake.calls.some((call) => call.table === 'completed_projects' && call.method === 'insert')).toBe(false)
  })

  it('sends a public final record to the pending review state', async () => {
    const inserted = record({
      id: 12,
      record_kind: 'final',
      anchor_type: 'final',
      title: '我的纸板桥',
      notes: '最终测试',
      visibility: 'public',
      status: 'pending',
      moderation_state: 'approved',
      moderation_source: 'local-sensitive-filter-v1',
    })
    const fake = createFakeClient([
      { data: journey, error: null },
      { data: null, error: null },
      { data: inserted, error: null },
      { data: null, error: null },
      { data: { id: 100 }, error: null },
      { data: null, error: null },
      { data: { id: 200 }, error: null },
      { data: null, error: null },
    ])

    const result = await upsertJourneyRecord(fake.client, journey.id, journey.user_id, {
      recordKind: 'final',
      anchorType: 'final',
      title: '我的纸板桥',
      notes: '最终测试',
      images: ['https://example.com/bridge.jpg'],
      visibility: 'public',
      moderationState: 'approved',
      moderationSource: 'local-sensitive-filter-v1',
    })

    expect(result).toMatchObject({
      record_kind: 'final',
      anchor_type: 'final',
      status: 'pending',
      visibility: 'public',
    })
    expect(fake.calls.some((call) => call.table === 'completed_projects' && call.method === 'insert')).toBe(true)
  })

  it('reopens the Journey after a rejected final record', async () => {
    const fake = createFakeClient([
      { data: { journey_id: journey.id, record_kind: 'final', user_id: journey.user_id }, error: null },
      { data: null, error: null },
    ])

    await reopenJourneyAfterRejectedRecord(fake.client, 11)

    const journeyUpdate = fake.calls.find((call) => call.table === 'project_journeys' && call.method === 'update')
    expect(journeyUpdate?.args[0]).toMatchObject({ status: 'active', completed_at: null })
  })

  it('marks a Journey completed only after its final record is approved', async () => {
    const fake = createFakeClient([
      {
        data: {
          id: 11,
          record_kind: 'final',
          status: 'approved',
          visibility: 'public',
          moderation_state: 'approved',
          updated_at: '2026-08-19T08:05:00.000Z',
        },
        error: null,
      },
      { data: null, error: null },
    ])

    await completeJourneyForApprovedFinal(fake.client, journey.id, journey.user_id, 11)

    const journeyUpdate = fake.calls.find((call) => call.table === 'project_journeys' && call.method === 'update')
    expect(journeyUpdate?.args[0]).toMatchObject({
      status: 'completed',
      completed_at: '2026-08-19T08:05:00.000Z',
    })
  })
})


describe('record review: isolated ownership, failure and reload contracts', () => {
  it('rejects a missing owned journey before writing', async () => {
    const fake = createFakeClient([{data: null, error: null}])
    await expect(upsertJourneyRecord(fake.client, 7, 'other-user', {notes: 'test'})).rejects.toThrow('无权操作')
    expect(fake.calls).toContainEqual({table: 'project_journeys', method: 'eq', args: ['user_id', 'other-user']})
    expect(fake.calls.some(c => c.method === 'insert' || c.method === 'update')).toBe(false)
  })
  it('propagates a write failure rather than reporting a saved record', async () => {
    const failure = new Error('simulated database unavailable')
    const fake = createFakeClient([{data: journey, error: null}, {data: null, error: failure}])
    await expect(upsertJourneyRecord(fake.client, 7, 'user-1', {recordKind: 'progress', notes: '未完成'})).rejects.toThrow('simulated database unavailable')
  })
  it('reads saved private records on a fresh read and propagates read errors', async () => {
    const saved = record({notes: '预测未验证', visibility: 'private'})
    const fresh = createFakeClient([{data: [saved], error: null}])
    expect(await listJourneyRecords(fresh.client, 7)).toEqual([saved])
    expect(fresh.calls).toContainEqual({table: 'project_journey_records', method: 'eq', args: ['journey_id', 7]})
    const failed = createFakeClient([{data: null, error: new Error('read failed')}])
    await expect(listJourneyRecords(failed.client, 7)).rejects.toThrow('read failed')
  })
})


it('still supports withdrawing public records without deleting them', async () => {
  const fake=createFakeClient([{data:journey},{data:record({visibility:'public'})},{data:record({visibility:'private'})},{data:null},{data:{id:50}},{data:null},{data:null}])
  await publishJourneyRecord(fake.client,7,11,'user-1','private')
  expect(fake.calls).toContainEqual(expect.objectContaining({table:'project_journey_records',method:'update',args:[expect.objectContaining({visibility:'private',status:'draft',published_at:null})]}))
})

it('keeps a newly published text record pending even when the pre-check approves', async () => {
  const pending=record({visibility:'public',status:'pending',moderation_state:'approved',published_at:null})
  const fake=createFakeClient([{data:journey},{data:pending},{data:null},{data:{id:50}},{data:null},{data:{id:60}},{data:null}])
  await upsertJourneyRecord(fake.client,7,'user-1',{recordKind:'progress',notes:'预测',images:[],visibility:'public',moderationState:'approved'})
  expect(fake.calls).toContainEqual(expect.objectContaining({table:'project_journey_records',method:'insert',args:[expect.objectContaining({visibility:'public',status:'pending',published_at:null})]}))
})

it('requires a new review when explicitly republishing a withdrawn record', async () => {
  const pending = record({ visibility: 'public', status: 'pending', moderation_state: 'pending' })
  const fake = createFakeClient([{data:journey},{data:record()},{data:pending},{data:null},{data:{id:50}},{data:null},{data:{id:60}},{data:null}])
  await publishJourneyRecord(fake.client, 7, 11, 'user-1', 'public')
  expect(fake.calls).toContainEqual(expect.objectContaining({table:'project_journey_records',method:'update',args:[expect.objectContaining({visibility:'public',status:'pending',moderation_state:'pending',published_at:null})]}))
})
