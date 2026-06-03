/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { POST, PATCH } from '@/app/api/challenges/[id]/submission/route'
import { requireAuth } from '@/lib/api/auth'
import { getChallengeSubmissionByUser } from '@/lib/api/challenge-submissions'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/api/challenge-submissions', () => ({
  getChallengeSubmissionByUser: vi.fn(),
}))

vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return {
    ...actual,
    requireAuth: vi.fn(),
  }
})

vi.mock('@/lib/api/rate-limit', () => ({
  requireRateLimit: vi.fn(),
}))

describe('challenge submission route', () => {
  const testSupabaseUrl = 'https://example.supabase.co'
  const ownedProofImageUrl = 'https://example.supabase.co/storage/v1/object/public/project-completions/challenge-submissions/user-1/image.png'
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>
  const getChallengeSubmissionByUserMock = getChallengeSubmissionByUser as Mock<typeof getChallengeSubmissionByUser>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', testSupabaseUrl)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
    requireRateLimitMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 409 when creating a duplicate challenge submission', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 3, title: '火箭挑战', status: 'active' },
      error: null,
    })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'challenges') {
          return { select }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    getChallengeSubmissionByUserMock.mockResolvedValue({
      id: 10,
      challengeId: 3,
      userId: 'user-1',
      title: '已存在作品',
      author: '测试用户',
      createdAt: '',
      updatedAt: '',
      proofImages: [ownedProofImageUrl],
      isPublic: true,
      ratingSummary: {
        avgCreativeExpression: 0,
        avgCompletionQuality: 0,
        avgEvidenceCompleteness: 0,
        avgReflectionDepth: 0,
        avgScore: 0,
        ratingCount: 0,
      },
      referenceProjects: [],
    } as never)

    const response = await POST(new NextRequest('http://localhost/api/challenges/3/submission', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '挑战作品',
        proof_images: [ownedProofImageUrl],
        is_public: true,
        reference_project_ids: [],
      }),
    }) as never, {
      params: Promise.resolve({ id: '3' }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: 'Submission already exists' })
  })

  it('blocks editing when the challenge is no longer active', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 3, title: '火箭挑战', status: 'ended' },
      error: null,
    })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'challenges') {
          return { select }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    const response = await PATCH(new NextRequest('http://localhost/api/challenges/3/submission', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '挑战作品',
        proof_images: [ownedProofImageUrl],
        is_public: true,
        reference_project_ids: [],
      }),
    }) as never, {
      params: Promise.resolve({ id: '3' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Challenge已结束，作品仅可查看' })
  })
})
