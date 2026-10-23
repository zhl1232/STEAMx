/** @vitest-environment node */

import { beforeEach, afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/ldraw-preview/route'
import { confirmLdrawModel } from '@/lib/courses/ldraw-review'

const isCandidateMock = vi.hoisted(() => vi.fn(() => false))
const inspectionRecordsMock = vi.hoisted(() => ({ value: {} as Record<string, { revision: string; status: 'needs-repair' | 'checked'; issues: string[] }> }))
const reviewRecordsMock = vi.hoisted(() => ({ value: {} as Record<string, { revision: string; confirmedAt: string }> }))

vi.mock('@/lib/courses/ldraw-review', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/courses/ldraw-review')>()
  return { ...actual, confirmLdrawModel: vi.fn(), isLdrawReviewCandidate: isCandidateMock, getLdrawReviewRecords: vi.fn(async () => reviewRecordsMock.value) }
})
vi.mock('@/lib/courses/ldraw-packer', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/courses/ldraw-packer')>(),
  packLocalLdrawModel: vi.fn(),
}))
vi.mock('@/lib/courses/ldraw-inspection', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/courses/ldraw-inspection')>(),
  getLdrawInspectionRecords: vi.fn(async () => inspectionRecordsMock.value),
}))

function req(origin: string | null, url = 'http://localhost:3000/api/ldraw-preview', revision = 'x', model = '__dry-run-nonexistent__.ldr') {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (origin) headers.origin = origin
  return new NextRequest(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ model, revision }),
  })
}

describe('PATCH /api/ldraw-preview confirm gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isCandidateMock.mockReturnValue(false)
    inspectionRecordsMock.value = {}
    reviewRecordsMock.value = {}
    vi.stubEnv('NODE_ENV', 'development')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('rejects direct confirmation of a production-protected model before packing or writing', async () => {
    const { packLocalLdrawModel } = await import('@/lib/courses/ldraw-packer')
    isCandidateMock.mockReturnValue(true)
    const response = await PATCH(req('http://localhost:3000', undefined, 'current', '3-shu-kou-bei.ldr'))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('LDRAW_PRODUCTION_PROTECTED')
    expect(packLocalLdrawModel).not.toHaveBeenCalled()
    expect(confirmLdrawModel).not.toHaveBeenCalled()
  })

  it('cannot bypass missing, stale, or repair inspection with a client revision', async () => {
    const { packLocalLdrawModel } = await import('@/lib/courses/ldraw-packer')
    isCandidateMock.mockReturnValue(true)
    ;(packLocalLdrawModel as Mock).mockResolvedValue({ revision: 'current', missingParts: [] })

    for (const entry of [
      {},
      { '__dry-run-nonexistent__.ldr': { revision: 'old', status: 'checked' as const, issues: [] } },
      { '__dry-run-nonexistent__.ldr': { revision: 'current', status: 'needs-repair' as const, issues: ['发现零件重叠'] } },
    ]) {
      inspectionRecordsMock.value = entry as typeof inspectionRecordsMock.value
      const response = await PATCH(req('http://localhost:3000', 'http://localhost:3000/api/ldraw-preview', 'current'))
      expect(response.status).toBe(409)
      expect(confirmLdrawModel).not.toHaveBeenCalled()
      const body = await response.json()
      expect(body.inspectionStatus).toBe(entry['__dry-run-nonexistent__.ldr']?.status === 'needs-repair' ? 'needs-repair' : 'unchecked')
      expect(body.code).toBe(entry['__dry-run-nonexistent__.ldr']?.status === 'needs-repair' ? 'LDRAW_INSPECTION_NEEDS_REPAIR' : 'LDRAW_INSPECTION_REQUIRED')
    }
  })

  it('allows a never-confirmed candidate only for the current checked inspection', async () => {
    const { packLocalLdrawModel } = await import('@/lib/courses/ldraw-packer')
    isCandidateMock.mockReturnValue(true)
    ;(packLocalLdrawModel as Mock).mockResolvedValue({ revision: 'current', missingParts: [] })
    inspectionRecordsMock.value = {
      '__dry-run-nonexistent__.ldr': { revision: 'current', status: 'checked', issues: [] },
    }
    ;(confirmLdrawModel as Mock).mockResolvedValue({ revision: 'current', confirmedAt: '2026-01-02T00:00:00.000Z' })

    const response = await PATCH(req('http://localhost:3000', 'http://localhost:3000/api/ldraw-preview', 'current'))
    expect(response.status).toBe(200)
    expect(confirmLdrawModel).toHaveBeenCalledWith('__dry-run-nonexistent__.ldr', 'current')
  })

  it('keeps historical confirmation exempt from the new inspection gate', async () => {
    const { packLocalLdrawModel } = await import('@/lib/courses/ldraw-packer')
    isCandidateMock.mockReturnValue(true)
    ;(packLocalLdrawModel as Mock).mockResolvedValue({ revision: 'current', missingParts: [] })
    reviewRecordsMock.value = { '__dry-run-nonexistent__.ldr': { revision: 'old', confirmedAt: '2026-01-01T00:00:00.000Z' } }
    ;(confirmLdrawModel as Mock).mockResolvedValue({ revision: 'current', confirmedAt: '2026-01-02T00:00:00.000Z' })

    const response = await PATCH(req('http://localhost:3000', 'http://localhost:3000/api/ldraw-preview', 'current'))
    expect(response.status).toBe(200)
    expect(confirmLdrawModel).toHaveBeenCalledWith('__dry-run-nonexistent__.ldr', 'current')
  })
})
