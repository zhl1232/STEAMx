import * as fs from 'node:fs/promises'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as packer from '@/lib/courses/ldraw-packer'
import * as review from '@/lib/courses/ldraw-review'
import * as inspection from '@/lib/courses/ldraw-inspection'

import { GET, PATCH, POST } from './route'

vi.mock('node:fs/promises', { spy: true })
vi.mock('@/lib/courses/ldraw-packer', { spy: true })
vi.mock('@/lib/courses/ldraw-review', { spy: true })
vi.mock('@/lib/courses/ldraw-inspection', { spy: true })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('LDraw preview source selection', () => {
  function setup(protectedModel = false, revision = 'fresh') {
    vi.stubEnv('NODE_ENV', 'development')
    const packed = { mpdText: 'fresh canonical source and dependencies', revision, stepCount: 2, partCount: 3, missingParts: [] }
    vi.spyOn(packer, 'packLocalLdrawModel').mockResolvedValue(packed)
    vi.spyOn(packer, 'readFrozenConfirmedLdrawModel').mockResolvedValue({ ...packed, mpdText: 'frozen confirmed MPD', revision: 'approved' })
    vi.spyOn(review, 'getLdrawReviewRecords').mockResolvedValue({ 'example.ldr': { revision: 'approved', confirmedAt: '2026-10-01' } })
    vi.spyOn(review, 'isProductionProtected').mockReturnValue(protectedModel)
    vi.spyOn(review, 'isLdrawReviewCandidate').mockReturnValue(true)
    vi.spyOn(inspection, 'getLdrawInspectionRecords').mockResolvedValue({})
  }

  it('keeps serving the frozen confirmation by default', async () => {
    setup()
    const response = await GET(new NextRequest('http://localhost:3000/api/ldraw-preview?model=example.ldr'))
    expect(await response.json()).toMatchObject({
      mpdText: 'frozen confirmed MPD', revision: 'approved', reviewStatus: 'confirmed',
      servedFrozenConfirmed: true, servedDraft: false, canConfirm: false,
    })
  })

  it.each([false, true])('serves the fresh draft with changed status (protected=%s) without writing', async (protectedModel) => {
    setup(protectedModel)
    const writes = vi.spyOn(fs, 'writeFile')
    const response = await GET(new NextRequest('http://localhost:3000/api/ldraw-preview?model=example.ldr&source=draft'))
    expect(await response.json()).toMatchObject({
      mpdText: 'fresh canonical source and dependencies', revision: 'fresh', reviewStatus: 'changed',
      legacyReviewStatus: 'pending', servedFrozenConfirmed: false, servedDraft: true,
      productionProtected: protectedModel, canConfirm: !protectedModel,
    })
    expect(packer.packLocalLdrawModel).toHaveBeenCalledWith('example.ldr', { forceFreshDependencies: true })
    expect(packer.readFrozenConfirmedLdrawModel).not.toHaveBeenCalled()
    expect(writes).not.toHaveBeenCalled()
  })

  it('retains confirmed status when the draft revision still matches the record', async () => {
    setup(true, 'approved')
    const response = await GET(new NextRequest('http://localhost:3000/api/ldraw-preview?model=example.ldr&source=draft'))
    expect(await response.json()).toMatchObject({ reviewStatus: 'confirmed', servedDraft: true, canConfirm: false })
  })

  it('keeps the protected PATCH guard for an explicit draft request', async () => {
    setup(true)
    const response = await PATCH(new NextRequest('http://localhost:3000/api/ldraw-preview?source=draft', {
      method: 'PATCH', headers: { origin: 'http://localhost:3000' },
      body: JSON.stringify({ model: 'example.ldr', revision: 'fresh' }),
    }))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'LDRAW_PRODUCTION_PROTECTED' })
    expect(packer.packLocalLdrawModel).not.toHaveBeenCalled()
  })
})

describe('LDraw preview environment boundary', () => {
  it.each(['production', 'test', ''])('rejects %s before parsing or filesystem work', async (mode) => {
    vi.stubEnv('NODE_ENV', mode)
    const reads = vi.spyOn(fs, 'readFile')
    const scans = vi.spyOn(fs, 'readdir')
    const writes = vi.spyOn(fs, 'writeFile')
    for (const handler of [GET, POST, PATCH]) {
      const request = new NextRequest('http://localhost:3000/api/ldraw-preview?model=3-hu-die.ldr', {
        method: handler.name,
        headers: { origin: 'http://localhost:3000', host: 'dev.steamx.cc' },
        ...(handler === GET ? {} : { body: '{invalid' }),
      })
      const parse = vi.spyOn(request, 'json')
      const response = await handler(request)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Not Found' })
      expect(response.headers.get('X-Robots-Tag')).toContain('noindex')
      expect(parse).not.toHaveBeenCalled()
    }
    expect(reads).not.toHaveBeenCalled()
    expect(scans).not.toHaveBeenCalled()
    expect(writes).not.toHaveBeenCalled()
  })

  it.each([
    undefined, 'https://evil.example', 'http://localhost:3001',
    'https://localhost:3000', 'null', 'not-a-url',
  ])('preserves PATCH rejection for origin %s', async (origin) => {
    vi.stubEnv('NODE_ENV', 'development')
    const request = new NextRequest('http://localhost:3000/api/ldraw-preview', {
      method: 'PATCH', headers: origin ? { origin } : {}, body: '{invalid',
    })
    const parse = vi.spyOn(request, 'json')
    expect((await PATCH(request)).status).toBe(403)
    expect(parse).not.toHaveBeenCalled()
  })

  it('rejects even same-origin PATCH on a public development hostname', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect((await PATCH(new NextRequest('https://dev.steamx.cc/api/ldraw-preview', {
      method: 'PATCH', headers: { origin: 'https://dev.steamx.cc' }, body: '{}',
    }))).status).toBe(403)
  })

  it('allows same-origin localhost PATCH to reach validation without writing', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const writes = vi.spyOn(fs, 'writeFile')
    expect((await PATCH(new NextRequest('http://localhost:3000/api/ldraw-preview', {
      method: 'PATCH', headers: { origin: 'http://localhost:3000' }, body: '{}',
    }))).status).toBe(400)
    expect(writes).not.toHaveBeenCalled()
  })

  it.each(['127.0.0.1', '[::1]'])('keeps rejecting %s when Next normalizes the request origin to localhost', async (host) => {
    vi.stubEnv('NODE_ENV', 'development')
    const request = new NextRequest(`http://${host}:3000/api/ldraw-preview`, {
      method: 'PATCH', headers: { origin: `http://${host}:3000` }, body: '{}',
    })
    expect(new URL(request.url).hostname).toBe('localhost')
    expect((await PATCH(request)).status).toBe(403)
  })
})
