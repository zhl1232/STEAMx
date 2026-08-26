import { describe, expect, it } from 'vitest'

import { summarizeCourseClosureAudit } from './lib/course-closure-audit.mjs'

describe('summarizeCourseClosureAudit', () => {
  it('treats missing rewards and milestones as blocking findings', () => {
    const report = summarizeCourseClosureAudit([
      {
        code: 'reward_missing',
        severity: 'P1',
        count: '2',
        rows: [{ completion_id: 1 }],
      },
      {
        code: 'trusted_milestone_missing',
        severity: 'P1',
        count: 1,
        rows: [{ course_id: 7 }],
      },
    ])

    expect(report.healthy).toBe(false)
    expect(report.blockingCount).toBe(3)
    expect(report.findings).toMatchObject([
      { code: 'reward_missing', count: 2, severity: 'P1' },
      { code: 'trusted_milestone_missing', count: 1, severity: 'P1' },
    ])
  })

  it('keeps historical orphan rewards as advisory findings', () => {
    const report = summarizeCourseClosureAudit([
      {
        code: 'reward_orphan',
        severity: 'P2',
        count: 3,
        rows: [{ resource_id: '7' }],
      },
    ])

    expect(report.healthy).toBe(true)
    expect(report.blockingCount).toBe(0)
    expect(report.advisoryCount).toBe(3)
  })

  it('normalizes string counts and ignores unknown zero-count findings', () => {
    const report = summarizeCourseClosureAudit([
      { code: 'unknown', severity: 'P1', count: 'not-a-number', rows: [] },
      { code: 'database_deadlocks', severity: 'P2', count: '4', rows: [] },
    ])

    expect(report.healthy).toBe(true)
    expect(report.findings).toMatchObject([
      { code: 'database_deadlocks', count: 4, severity: 'P2' },
    ])
  })
})
