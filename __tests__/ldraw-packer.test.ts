import { beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  realpath: vi.fn(),
  stat: vi.fn(),
}))

vi.mock('node:fs/promises', () => fs)

const review = vi.hoisted(() => ({
  records: {} as Record<string, { revision: string; confirmedAt: string }>,
}))

vi.mock('@/lib/courses/ldraw-review', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/courses/ldraw-review')>(),
  getLdrawReviewRecords: vi.fn(async () => review.records),
}))

import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/ldraw-preview/route'
import { listAllLdrawModels, packLocalLdrawModel, readFrozenConfirmedLdrawModel } from '@/lib/courses/ldraw-packer'

const modelRoot = `${process.cwd()}/scripts/ldraw-models`
const outputRoot = `${process.cwd()}/public/courses/ldraw`
const sharedPartPath = `${modelRoot}/parts/shared.dat`
const mpdPath = `${outputRoot}/existing.mpd`

const modelSource = (name: string) =>
  `0 ${name}\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 shared.dat\n0 STEP\n`

let frozenBytes: Buffer | null = null
let dependencyText = '0 Shared dependency v1\n'
const modelSources: Record<string, string> = {
  '3-pang-xie.ldr': modelSource('Pang Xie'),
  '3-pen-zai.ldr': modelSource('Pen Zai'),
}

function enoent(path: string): never {
  const error = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException
  error.code = 'ENOENT'
  throw error
}

function readCount(path: string) {
  return fs.readFile.mock.calls.filter(([candidate]) => candidate === path).length
}

beforeEach(() => {
  frozenBytes = null
  dependencyText = '0 Shared dependency v1\n'
  review.records = {}
  vi.clearAllMocks()

  fs.readdir.mockImplementation(async (path: string) => {
    if (path === modelRoot) return Object.keys(modelSources)
    if (path === outputRoot) return ['existing.mpd']
    return enoent(path)
  })
  fs.realpath.mockImplementation(async (path: string) => {
    if (path === modelRoot || path === `${modelRoot}/parts` || path === sharedPartPath) return path
    if (Object.keys(modelSources).some((name) => path === `${modelRoot}/${name}`)) return path
    return enoent(path)
  })
  fs.stat.mockResolvedValue({ size: 100, mtime: new Date('2026-01-01T00:00:00.000Z') })
  fs.readFile.mockImplementation(async (path: string, encoding?: string) => {
    if (path === `${outputRoot}/3-pang-xie.mpd` && frozenBytes) return encoding ? frozenBytes.toString('utf8') : frozenBytes
    if (path === mpdPath) return '0 FILE existing.ldr\n0 Existing\n'
    if (path === sharedPartPath) return dependencyText
    const modelName = Object.keys(modelSources).find((name) => path === `${modelRoot}/${name}`)
    if (modelName) return modelSources[modelName]
    return enoent(path)
  })
})

describe('ldraw packer request-scoped dependency reads', () => {
  it('shares fresh MPD and local dependency reads across confirmed models in one list', async () => {
    const first = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })
    const second = await packLocalLdrawModel('3-pen-zai.ldr', { forceFreshDependencies: true })
    review.records = {
      '3-pang-xie.ldr': { revision: first.revision, confirmedAt: '2026-01-01T00:00:00.000Z' },
      '3-pen-zai.ldr': { revision: second.revision, confirmedAt: '2026-01-01T00:00:00.000Z' },
    }
    vi.clearAllMocks()

    const models = await listAllLdrawModels()

    expect(models.filter((model) => model.reviewStatus === 'confirmed')).toHaveLength(2)
    expect(readCount(mpdPath)).toBe(1)
    expect(readCount(sharedPartPath)).toBe(1)
  })

  it('uses fresh dependency content for a separate list and invalidates confirmation', async () => {
    const initial = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })
    review.records = {
      '3-pang-xie.ldr': { revision: initial.revision, confirmedAt: '2026-01-01T00:00:00.000Z' },
    }

    const confirmed = await listAllLdrawModels()
    expect(confirmed.find((model) => model.name === '3-pang-xie.ldr')?.reviewStatus).toBe('confirmed')

    dependencyText = '0 Shared dependency v2\n'
    const changed = await listAllLdrawModels()

    expect(changed.find((model) => model.name === '3-pang-xie.ldr')?.reviewStatus).toBe('changed')
    expect(readCount(sharedPartPath)).toBe(3)
  })

  it('produces the same revision for a fresh single pack as list confirmation checking', async () => {
    const initial = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })
    review.records = {
      '3-pang-xie.ldr': { revision: initial.revision, confirmedAt: '2026-01-01T00:00:00.000Z' },
    }
    dependencyText = '0 Shared dependency v2\n'

    const listed = await listAllLdrawModels()
    const fresh = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })

    expect(listed.find((model) => model.name === '3-pang-xie.ldr')?.reviewStatus).toBe('changed')
    expect(fresh.revision).not.toBe(initial.revision)

    review.records['3-pang-xie.ldr'].revision = fresh.revision
    const confirmedWithFreshRevision = await listAllLdrawModels()
    expect(confirmedWithFreshRevision.find((model) => model.name === '3-pang-xie.ldr')?.reviewStatus).toBe('confirmed')
  })
})


describe('frozen confirmed MPD preview', () => {
  async function freeze() {
    const initial = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })
    // Preserve CRLF and trailing whitespace: approval hashes bytes, not normalized text.
    frozenBytes = Buffer.from(initial.mpdText.replace(/\n/g, '\r\n') + '  \r\n')
    const revision = createHash('sha256').update(frozenBytes).digest('hex')
    review.records = { '3-pang-xie.ldr': { revision, confirmedAt: '2026-01-01T00:00:00.000Z' } }
    dependencyText = '0 Changed dependency\n0 STEP\n'
    return { revision, mpdText: frozenBytes.toString('utf8'), stepCount: 2, partCount: 1 }
  }

  it('serves exact frozen bytes and their metadata when only the published hash matches', async () => {
    const frozen = await freeze()
    const response = await GET(new NextRequest('http://localhost/api/ldraw-preview?model=3-pang-xie.ldr'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ...frozen, missingParts: [], reviewStatus: 'confirmed', servedFrozenConfirmed: true, canConfirm: false,
    })
    const models = await listAllLdrawModels()
    expect(models.find((model) => model.name === '3-pang-xie.ldr')?.reviewStatus).toBe('confirmed')
  })

  it('returns fresh preview and changed status when the frozen hash also differs', async () => {
    await freeze()
    frozenBytes = Buffer.from('0 FILE different.ldr\n0 Different published version\n')
    const fresh = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })
    const response = await GET(new NextRequest('http://localhost/api/ldraw-preview?model=3-pang-xie.ldr'))
    expect(await response.json()).toMatchObject({ ...fresh, reviewStatus: 'changed', legacyReviewStatus: 'pending', servedFrozenConfirmed: false, canConfirm: true })
  })

  it('uses fresh confirmed output when its hash matches, even if a frozen file exists', async () => {
    await freeze()
    const fresh = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })
    review.records['3-pang-xie.ldr'].revision = fresh.revision
    const response = await GET(new NextRequest('http://localhost/api/ldraw-preview?model=3-pang-xie.ldr'))
    expect(await response.json()).toMatchObject({ ...fresh, reviewStatus: 'confirmed', servedFrozenConfirmed: false, canConfirm: false })
  })

  it('does not treat a published artifact without a review record as confirmed', async () => {
    await freeze()
    review.records = {}
    const response = await GET(new NextRequest('http://localhost/api/ldraw-preview?model=3-pang-xie.ldr'))
    expect(await response.json()).toMatchObject({ reviewStatus: 'unconfirmed', legacyReviewStatus: 'pending', servedFrozenConfirmed: false })
  })

  it('returns null for a missing frozen file or unsafe model path', async () => {
    const record = { revision: 'old', confirmedAt: '2026-01-01' }
    expect(await readFrozenConfirmedLdrawModel('3-pang-xie.ldr', record)).toBeNull()
    expect(await readFrozenConfirmedLdrawModel('../outside.ldr', record)).toBeNull()
  })

  it('counts records with no source model in the list response', async () => {
    review.records = { 'missing-source.ldr': { revision: 'old', confirmedAt: '2026-01-01' } }
    const response = await GET(new NextRequest('http://localhost/api/ldraw-preview'))
    expect(await response.json()).toMatchObject({ total: 2, reviewRecordCount: 1 })
  })
})

it('marks protected changed drafts confirmed in both the preview and list', async () => {
  const name = '3-shu-kou-bei.ldr'
  modelSources[name] = modelSource('Protected')
  review.records[name] = { revision: 'previous-production', confirmedAt: '2026-01-01' }
  try {
    const response = await GET(new NextRequest(`http://localhost/api/ldraw-preview?model=${name}`))
    expect(await response.json()).toMatchObject({
      reviewStatus: 'confirmed', productionProtected: true, canConfirm: false, servedFrozenConfirmed: false,
    })
    expect((await listAllLdrawModels()).find((model) => model.name === name)).toMatchObject({
      reviewStatus: 'confirmed', productionProtected: true,
    })
  } finally { delete modelSources[name] }
})
