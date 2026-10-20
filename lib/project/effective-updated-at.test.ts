import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import { effectiveUpdatedAt } from './effective-updated-at'
import { applyLedCardContent } from './led-card'
import { applyScienceSample } from './science-samples'
import reviewed from './science-reviewed.data.json'
import releases from './published-content-dates.json'

const databaseDate = '2026-03-24T00:00:00Z'
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('effective content update dates', () => {
  it.each([
    [149, '2026-10-09T10:01:35.000Z'],
    [478, '2026-10-11T10:25:44.000Z'],
    [738, '2026-10-12T02:50:18.000Z'],
    [1176, '2026-10-12T08:39:06.000Z'],
    [1323, '2026-10-12T08:39:06.000Z'],
  ])('uses the confirmed deployment of project %i, including the later 59 projects', (id, expected) => {
    const title = reviewed.find(row => row.id === id)?.title ?? 'LED 发光贺卡'
    const original = { id, title, category: '科学', createdAt: databaseDate, updatedAt: databaseDate } as Project
    const result = applyScienceSample(applyLedCardContent(original))
    expect(result.updatedAt).toBe(expected)
    expect(result.createdAt).toBe(databaseDate)
    expect(original.updatedAt).toBe(databaseDate)
    expect(effectiveUpdatedAt(result)).toBe(expected)
  })

  it('preserves a newer database edit and normalizes timezone offsets', () => {
    expect(effectiveUpdatedAt({ id: 149, updatedAt: '2026-10-15T08:00:00+08:00' }))
      .toBe('2026-10-15T00:00:00.000Z')
    expect(effectiveUpdatedAt({ id: 149, updatedAt: '2026-10-09T18:01:35+08:00' }))
      .toBe('2026-10-09T10:01:35.000Z')
  })

  it.each([undefined, null, '', ' ', 'not-a-date'])('handles a missing or invalid database date (%s)', updatedAt => {
    expect(effectiveUpdatedAt({ id: 149, updatedAt })).toBe('2026-10-09T10:01:35.000Z')
    expect(effectiveUpdatedAt({ id: 42, updatedAt })).toBeUndefined()
  })

  it('keeps database dates for unknown projects and mismatched science identities', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const sample = reviewed[0]
    for (const identity of [
      { id: 42, title: sample.title, category: '科学' },
      { id: sample.id, title: '另一个标题', category: '科学' },
      { id: sample.id, title: sample.title, category: '工程' },
      { id: sample.id },
    ]) {
      const project = { ...identity, updatedAt: databaseDate } as Project
      expect(applyScienceSample(project)).toBe(project)
      expect(effectiveUpdatedAt(project)).toBe('2026-03-24T00:00:00.000Z')
    }
  })

  it('does not use today, the latest main commit or an unrelated application deployment', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    expect(effectiveUpdatedAt({ id: 149, updatedAt: databaseDate })).toBe('2026-10-09T10:01:35.000Z')
    expect(effectiveUpdatedAt({ id: 42, updatedAt: databaseDate })).toBe('2026-03-24T00:00:00.000Z')
  })

  it('covers the current released overrides once with explicit deployment provenance', () => {
    const ids = releases.flatMap(release => release.projectIds)
    expect(ids.sort((a, b) => a - b)).toEqual([149, ...reviewed.map(row => row.id)].sort((a, b) => a - b))
    expect(new Set(ids).size).toBe(ids.length)
    expect(releases.map(release => release.projectIds.length)).toEqual([1, 27, 28, 59])
    for (const release of releases) {
      expect(release.commit).toMatch(/^[a-f0-9]{40}$/)
      expect(release.workflowRunId).toBeGreaterThan(0)
      expect(Date.parse(release.updatedAt)).toBeLessThan(Date.parse('2026-10-14T00:00:00Z'))
    }
  })
})
