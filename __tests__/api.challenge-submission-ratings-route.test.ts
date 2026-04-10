/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/challenges/submissions/ratings/route'
import { GET } from '@/app/api/challenges/submissions/ratings/[submissionId]/route'
import { requireAuth } from '@/lib/api/auth'
import { getChallengeRatingSubmission } from '@/lib/api/project-access'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/api/project-access', () => ({
  getChallengeRatingSubmission: vi.fn(),
}))

vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return {
    ...actual,
    requireAuth: vi.fn(),
  }
})

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('challenge submission rating routes', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const getChallengeRatingSubmissionMock = getChallengeRatingSubmission as Mock<typeof getChallengeRatingSubmission>

  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
  })

  it('rejects rating a non-public challenge submission', async () => {
    const from = vi.fn()
    createClientMock.mockResolvedValue({ from } as never)
    getChallengeRatingSubmissionMock.mockResolvedValue(null)

    const response = await POST(new Request('http://localhost/api/challenges/submissions/ratings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        submissionId: 12,
        creativeExpression: 4,
        completionQuality: 4,
        evidenceCompleteness: 4,
        reflectionDepth: 4,
      }),
    }) as never)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Challenge submission not found' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects fetching ratings for a non-public challenge submission', async () => {
    const from = vi.fn()
    createClientMock.mockResolvedValue({
      from,
      auth: {
        getUser: vi.fn(),
      },
    } as never)
    getChallengeRatingSubmissionMock.mockResolvedValue(null)

    const response = await GET(
      new NextRequest('http://localhost/api/challenges/submissions/ratings/12') as never,
      { params: Promise.resolve({ submissionId: '12' }) },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Challenge submission not found' })
    expect(from).not.toHaveBeenCalled()
  })
})
