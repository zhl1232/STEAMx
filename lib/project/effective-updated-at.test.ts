import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectiveUpdatedAt } from './effective-updated-at'
import { applyLedCardContent } from './led-card'
import { applyScienceSample } from './science-samples'
import reviewed from './science-reviewed.data.json'
import legacy from './science-samples.data.json'
import dates from './published-content-dates.json'
import type { Project } from '@/lib/mappers/types'

afterEach(() => vi.unstubAllEnvs())
const old = '2026-03-24T00:00:00Z'

describe('published content modification dates', () => {
  it('uses the main publication commit for LED, first and second batch content', () => {
    const cases = [[149, '2026-10-09T09:50:34.000Z'], [478, '2026-10-11T10:16:55.000Z'], [738, '2026-10-12T02:40:20.000Z']] as const
    for (const [id, expected] of cases) {
      const sample = reviewed.find(row => row.id === id)
      const original = { id, title: sample?.title ?? 'LED 发光贺卡', category: '科学', updatedAt: old, createdAt: old } as Project
      const result = applyScienceSample(applyLedCardContent(original))
      expect(result.updatedAt).toBe(expected)
      expect(result.createdAt).toBe(old)
      expect(original.updatedAt).toBe(old)
      expect(effectiveUpdatedAt(result)).toBe(expected)
    }
  })
  it('preserves newer database changes and omits absent or invalid dates', () => {
    expect(effectiveUpdatedAt({ id:149, updatedAt:'2026-10-13T00:00:00Z' })).toBe('2026-10-13T00:00:00.000Z')
    expect(effectiveUpdatedAt({ id:149, updatedAt:'invalid' })).toBe('2026-10-09T09:50:34.000Z')
    for (const updatedAt of [null, undefined, '', 'invalid']) expect(effectiveUpdatedAt({ id:42, updatedAt })).toBeUndefined()
    expect(effectiveUpdatedAt({ id:42, updatedAt:old })).toBe('2026-03-24T00:00:00.000Z')
  })
  it('keeps the identity guards and unpublished legacy drafts unchanged', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const sample = reviewed[0]
    for (const identity of [{ title:'renamed', category:'科学' }, { title:sample.title, category:'工程' }]) {
      const project = { id:sample.id, ...identity, updatedAt:old } as Project
      expect(applyScienceSample(project)).toBe(project)
      expect(effectiveUpdatedAt(project)).toBe('2026-03-24T00:00:00.000Z')
    }
    for (const sample of legacy) {
      const project = { ...sample, category:'科学', updatedAt:old } as unknown as Project
      expect(applyScienceSample(project)).toBe(project)
      expect(effectiveUpdatedAt(project)).toBe('2026-03-24T00:00:00.000Z')
    }
  })
  it('covers exactly the released overrides with auditable commit provenance', () => {
    expect(Object.keys(dates).map(Number).sort((a,b)=>a-b)).toEqual([149,...reviewed.map(row=>row.id)].sort((a,b)=>a-b))
    for (const entry of Object.values(dates)) {
      expect(entry.commit).toMatch(/^[a-f0-9]{40}$/)
      expect(Number.isFinite(Date.parse(entry.updatedAt))).toBe(true)
    }
  })
})
