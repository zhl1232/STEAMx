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

vi.mock('@/lib/courses/ldraw-review', () => ({
  getLdrawReviewRecords: vi.fn(async () => review.records),
  reviewRecordFor: (fileName: string, records: typeof review.records) => records[fileName] ?? null,
  reviewStatusFor: (fileName: string, records: typeof review.records, revision?: string) => {
    if (!['3-pang-xie.ldr', '3-pen-zai.ldr'].includes(fileName)) return 'untracked'
    const record = records[fileName]
    return record && (!revision || record.revision === revision) ? 'confirmed' : 'pending'
  },
}))

import { listAllLdrawModels, packLocalLdrawModel } from '@/lib/courses/ldraw-packer'

const modelRoot = `${process.cwd()}/scripts/ldraw-models`
const outputRoot = `${process.cwd()}/public/courses/ldraw`
const sharedPartPath = `${modelRoot}/parts/shared.dat`
const mpdPath = `${outputRoot}/existing.mpd`

const modelSource = (name: string) =>
  `0 ${name}\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 shared.dat\n0 STEP\n`

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
  fs.readFile.mockImplementation(async (path: string) => {
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

    expect(changed.find((model) => model.name === '3-pang-xie.ldr')?.reviewStatus).toBe('pending')
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

    expect(listed.find((model) => model.name === '3-pang-xie.ldr')?.reviewStatus).toBe('pending')
    expect(fresh.revision).not.toBe(initial.revision)

    review.records['3-pang-xie.ldr'].revision = fresh.revision
    const confirmedWithFreshRevision = await listAllLdrawModels()
    expect(confirmedWithFreshRevision.find((model) => model.name === '3-pang-xie.ldr')?.reviewStatus).toBe('confirmed')
  })
})
