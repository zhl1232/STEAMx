/** @vitest-environment node */

import { describe, expect, it } from 'vitest'
import {
  canResubmitCompletion,
  getLatestCompletionStatusMap,
  getTrackedCompletedProjectIds,
  isTrackedCompletionStatus,
} from '@/lib/completion-records'

describe('completion record helpers', () => {
  it('tracks only pending and approved completions as active submissions', () => {
    expect(isTrackedCompletionStatus('pending')).toBe(true)
    expect(isTrackedCompletionStatus('approved')).toBe(true)
    expect(isTrackedCompletionStatus(null)).toBe(true)
    expect(isTrackedCompletionStatus('rejected')).toBe(false)

    expect(
      getTrackedCompletedProjectIds([
        { project_id: 1, status: 'approved' },
        { project_id: 2, status: 'pending' },
        { project_id: 3, status: 'rejected' },
      ])
    ).toEqual([1, 2])
  })

  it('allows resubmission only for rejected completions', () => {
    expect(canResubmitCompletion('rejected')).toBe(true)
    expect(canResubmitCompletion('pending')).toBe(false)
    expect(canResubmitCompletion('approved')).toBe(false)
  })

  it('keeps the latest status per project when rows are ordered by newest first', () => {
    const statusMap = getLatestCompletionStatusMap([
      { project_id: 7, status: 'rejected', rejection_reason: '需要更清晰的图片' },
      { project_id: 7, status: 'pending' },
      { project_id: 8, status: 'approved' },
    ])

    expect(statusMap.get(7)).toEqual({
      status: 'rejected',
      rejectionReason: '需要更清晰的图片',
    })
    expect(statusMap.get(8)).toEqual({
      status: 'approved',
      rejectionReason: undefined,
    })
  })
})
