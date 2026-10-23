/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const readFile = vi.hoisted(() => vi.fn())
vi.mock('node:fs/promises', () => ({ readFile }))

import { getLdrawInspectionRecords, inspectionFor } from '@/lib/courses/ldraw-inspection'

describe('version-bound LDraw inspection gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails closed when the manifest is missing or malformed', async () => {
    const missing = Object.assign(new Error('missing'), { code: 'ENOENT' })
    readFile.mockRejectedValueOnce(missing)
    expect(await getLdrawInspectionRecords()).toEqual({})

    readFile.mockResolvedValueOnce('{"model.ldr":{"revision":3}}')
    expect(await getLdrawInspectionRecords()).toEqual({})
  })

  it('treats missing and stale entries as unchecked', () => {
    expect(inspectionFor('model.ldr', 'new', {}, false)).toMatchObject({ status: 'unchecked', reason: 'missing' })
    expect(inspectionFor('model.ldr', 'new', {
      'model.ldr': { revision: 'old', status: 'checked', issues: [] },
    }, false)).toMatchObject({ status: 'unchecked', reason: 'stale' })
  })

  it('blocks repair entries and enables only the current checked revision', () => {
    const records = {
      'broken.ldr': { revision: 'r1', status: 'needs-repair' as const, issues: ['发现零件重叠'] },
      'checked.ldr': { revision: 'r2', status: 'checked' as const, issues: ['保留的装饰性接触'] },
    }
    expect(inspectionFor('broken.ldr', 'r1', records, false)).toMatchObject({ status: 'needs-repair', issues: ['发现零件重叠'] })
    expect(inspectionFor('checked.ldr', 'r2', records, false)).toMatchObject({ status: 'checked', issues: ['保留的装饰性接触'] })
  })

  it('exempts every historical confirmation from the inspection gate', () => {
    expect(inspectionFor('historical.ldr', 'new', {}, true)).toMatchObject({ status: 'exempt', reason: 'current' })
  })
})
