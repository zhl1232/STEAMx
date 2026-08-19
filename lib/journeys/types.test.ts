import { describe, expect, it } from 'vitest'

import {
  getJourneySourceId,
  mapJourney,
  mapJourneyRecord,
  type JourneyRecordRow,
  type JourneyRow,
} from '@/lib/journeys/types'

const projectJourney = {
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
} satisfies JourneyRow

describe('journey type mappings', () => {
  it('maps a project or challenge source to one source id', () => {
    expect(getJourneySourceId(projectJourney)).toBe(42)
    expect(getJourneySourceId({ ...projectJourney, source_type: 'challenge', project_id: null, challenge_id: 9 })).toBe(9)
  })

  it('adds sourceId without changing the persisted row shape', () => {
    expect(mapJourney(projectJourney)).toMatchObject({
      id: 7,
      source_type: 'project',
      sourceId: 42,
    })
  })

  it('rejects a malformed Journey without a source id', () => {
    expect(() => mapJourney({ ...projectJourney, project_id: null } as JourneyRow)).toThrow('has no source id')
  })

  it('keeps record rows unchanged for the timeline DTO', () => {
    const record = {
      id: 11,
      journey_id: 7,
      user_id: 'user-1',
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
    } satisfies JourneyRecordRow

    expect(mapJourneyRecord(record)).toBe(record)
  })
})
