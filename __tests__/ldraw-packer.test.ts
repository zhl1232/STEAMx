import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
import { listAllLdrawModels, packLdrawTextToMpd, packLocalLdrawModel, readFrozenConfirmedLdrawModel, type LdrawModelInfo } from '@/lib/courses/ldraw-packer'

const modelRoot = `${process.cwd()}/scripts/ldraw-models`
const outputRoot = `${process.cwd()}/public/courses/ldraw`
const sharedPartPath = `${modelRoot}/parts/shared.dat`
const mpdPath = `${outputRoot}/existing.mpd`

const modelSource = (name: string) =>
  `0 ${name}\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 shared.dat\n0 STEP\n`

let frozenBytes: Buffer | null = null
let dependencyText = '0 Shared dependency v1\n'
let fallbackText = '0 FILE existing.ldr\n0 Existing\n'
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

afterEach(() => vi.unstubAllEnvs())

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development')
  frozenBytes = null
  dependencyText = '0 Shared dependency v1\n'
  fallbackText = '0 FILE existing.ldr\n0 Existing\n'
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
    if (path === mpdPath) return fallbackText
    if (path === sharedPartPath) return dependencyText
    const modelName = Object.keys(modelSources).find((name) => path === `${modelRoot}/${name}`)
    if (modelName) return modelSources[modelName]
    return enoent(path)
  })
})

describe('ldraw packer request-scoped dependency reads', () => {
  it('shares fresh local dependency reads without scanning unrelated MPDs in one list', async () => {
    const first = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })
    const second = await packLocalLdrawModel('3-pen-zai.ldr', { forceFreshDependencies: true })
    review.records = {
      '3-pang-xie.ldr': { revision: first.revision, confirmedAt: '2026-01-01T00:00:00.000Z' },
      '3-pen-zai.ldr': { revision: second.revision, confirmedAt: '2026-01-01T00:00:00.000Z' },
    }
    vi.clearAllMocks()

    const models = await listAllLdrawModels()

    expect(models.filter((model) => model.reviewStatus === 'confirmed')).toHaveLength(2)
    expect(readCount(mpdPath)).toBe(0)
    expect(readCount(sharedPartPath)).toBe(1)
  })

  it('packs local dependencies with identical bytes and revision without reading any MPD', async () => {
    const expected = `0 FILE 3-pang-xie.ldr\n${modelSources['3-pang-xie.ldr']}\n0 FILE shared.dat\n${dependencyText}`

    const result = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })

    expect(result).toMatchObject({
      mpdText: expected,
      revision: createHash('sha256').update(expected, 'utf8').digest('hex'),
      partCount: 1,
      missingParts: [],
    })
    expect(fs.readdir).not.toHaveBeenCalledWith(outputRoot)
    expect(readCount(mpdPath)).toBe(0)
  })

  it('shares lazy fallback reads across a list and refreshes them for the next list', async () => {
    const localRealpath = fs.realpath.getMockImplementation()!
    fs.realpath.mockImplementation(async (path: string) => path === sharedPartPath ? enoent(path) : localRealpath(path))
    const localReadFile = fs.readFile.getMockImplementation()!
    fs.readFile.mockImplementation(async (path: string, encoding?: string) => path === `${modelRoot}/3-pen-zai.ldr`
      ? modelSources['3-pen-zai.ldr'].replace('shared.dat', 'other.dat')
      : localReadFile(path, encoding))
    fallbackText = '0 FILE existing.ldr\n0 Existing\n0 FILE shared.dat\n0 Fallback v1\n0 FILE other.dat\n0 Fallback v1\n'
    const first = await packLocalLdrawModel('3-pang-xie.ldr', { forceFreshDependencies: true })
    const second = await packLocalLdrawModel('3-pen-zai.ldr', { forceFreshDependencies: true })
    review.records = {
      '3-pang-xie.ldr': { revision: first.revision, confirmedAt: '2026-01-01' },
      '3-pen-zai.ldr': { revision: second.revision, confirmedAt: '2026-01-01' },
    }
    vi.clearAllMocks()

    expect((await listAllLdrawModels()).every((model) => model.reviewStatus === 'confirmed')).toBe(true)
    expect(readCount(mpdPath)).toBe(1)

    fallbackText = fallbackText.replaceAll('Fallback v1', 'Fallback v2')
    expect((await listAllLdrawModels()).every((model) => model.reviewStatus === 'changed')).toBe(true)
    expect(readCount(mpdPath)).toBe(2)
    expect(readCount(sharedPartPath)).toBe(0)
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

describe('recorded model list summaries', () => {
  it('serves saved inspection summaries from the list endpoint without packing reviewed models', async () => {
    review.records = { '3-pen-zai.ldr': { revision: 'recorded', confirmedAt: '2026-01-01' } }
    const read = fs.readFile.getMockImplementation()!
    fs.readFile.mockImplementation(async (path: string, encoding?: string) => {
      if (path === `${process.cwd()}/scripts/ldraw-inspections.json`) {
        return JSON.stringify({ '3-pang-xie.ldr': { revision: 'checked', status: 'checked', issues: [] } })
      }
      return read(path, encoding)
    })

    const response = await GET(new NextRequest('http://localhost/api/ldraw-preview'))
    const { models } = await response.json()

    expect(models.find((model: LdrawModelInfo) => model.name === '3-pang-xie.ldr')).toMatchObject({
      reviewStatus: 'unconfirmed', inspectionStatus: 'checked',
    })
    expect(readCount(sharedPartPath)).toBe(0)
    expect(readCount(mpdPath)).toBe(0)
    expect(fs.realpath).not.toHaveBeenCalled()
  })

  it('shows saved inspections for candidates awaiting their first confirmation', async () => {
    const models = await listAllLdrawModels({}, {
      verifyRevisions: false,
      inspections: {
        '3-pang-xie.ldr': { revision: 'checked', status: 'checked', issues: [] },
        '3-pen-zai.ldr': { revision: 'repair', status: 'needs-repair', issues: ['Loose connection'] },
      },
    })
    expect(models.find((model) => model.name === '3-pang-xie.ldr')).toMatchObject({ reviewStatus: 'unconfirmed', inspectionStatus: 'checked' })
    expect(models.find((model) => model.name === '3-pen-zai.ldr')).toMatchObject({ reviewStatus: 'unconfirmed', inspectionStatus: 'needs-repair' })
    expect(readCount(sharedPartPath)).toBe(0)
    expect(readCount(mpdPath)).toBe(0)
  })

  it('lists checked and repair records without reading dependencies or frozen MPDs', async () => {
    review.records = {
      '3-pang-xie.ldr': { revision: 'approved', confirmedAt: '2026-01-01' },
      '3-pen-zai.ldr': { revision: 'old', confirmedAt: '2026-01-02' },
    }

    const models = await listAllLdrawModels(review.records, {
      verifyRevisions: false,
      inspections: {
        '3-pang-xie.ldr': { revision: 'approved', status: 'checked', issues: [] },
        '3-pen-zai.ldr': { revision: 'repair', status: 'needs-repair', issues: ['Loose connection'] },
      },
    })

    expect(models.find((model) => model.name === '3-pang-xie.ldr')).toMatchObject({
      title: 'Pang Xie', sizeBytes: 100, category: '3+', reviewStatus: 'confirmed', inspectionStatus: 'checked', inspectionIssues: [],
    })
    expect(models.find((model) => model.name === '3-pen-zai.ldr')).toMatchObject({
      reviewStatus: 'changed', inspectionStatus: 'needs-repair', inspectionIssues: ['Loose connection'],
    })
    expect(fs.readFile.mock.calls.map(([path]) => path).sort()).toEqual(Object.keys(modelSources).map((file) => `${modelRoot}/${file}`).sort())
    expect(fs.realpath).not.toHaveBeenCalled()
  })

  it('uses stored confirmation or unchecked status when an inspection is absent', async () => {
    review.records = { '3-pang-xie.ldr': { revision: 'approved', confirmedAt: '2026-01-01' } }
    const models = await listAllLdrawModels(review.records, { verifyRevisions: false })
    expect(models.find((model) => model.name === '3-pang-xie.ldr')).toMatchObject({ reviewStatus: 'confirmed', inspectionStatus: 'exempt' })
    expect(models.find((model) => model.name === '3-pen-zai.ldr')).toMatchObject({ reviewStatus: 'unconfirmed', inspectionStatus: 'unchecked' })
    expect(readCount(sharedPartPath)).toBe(0)
    expect(readCount(mpdPath)).toBe(0)
  })
})

describe('local dependency boundaries', () => {
  it.each(['../private.dat', '/private.dat', 'C:\\private.dat'])('rejects unsafe reference %s before any dependency reads', async (ref) => {
    const result = await packLdrawTextToMpd(modelSource('Unsafe').replace('shared.dat', ref), 'unsafe', { forceFreshDependencies: true })
    expect(result.missingParts).toEqual([ref])
    expect(fs.realpath).not.toHaveBeenCalled()
    expect(fs.readdir).not.toHaveBeenCalled()
    expect(fs.readFile).not.toHaveBeenCalled()
  })

  it('does not read a local part symlink outside its trusted root', async () => {
    const localRealpath = fs.realpath.getMockImplementation()!
    fs.realpath.mockImplementation(async (path: string) => path === sharedPartPath ? '/private/shared.dat' : localRealpath(path))
    const result = await packLdrawTextToMpd(modelSource('Symlink'), 'symlink', { forceFreshDependencies: true })
    expect(result.missingParts).toEqual(['shared.dat'])
    expect(fs.readFile).not.toHaveBeenCalledWith('/private/shared.dat', 'utf8')
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
    expect(await response.json()).toMatchObject({ ...fresh, reviewStatus: 'changed', legacyReviewStatus: 'pending', servedFrozenConfirmed: false, canConfirm: true, inspectionStatus: 'exempt' })
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
    expect((await listAllLdrawModels(review.records, {
      verifyRevisions: false,
      inspections: { [name]: { revision: 'changed', status: 'checked', issues: [] } },
    })).find((model) => model.name === name)).toMatchObject({ reviewStatus: 'confirmed', productionProtected: true })
  } finally { delete modelSources[name] }
})
