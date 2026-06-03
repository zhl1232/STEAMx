/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  validateChallengeSubmissionContent,
  validateChallengeSubmissionMediaOwnership,
} from '@/lib/api/challenge-submission-validation'
import type { ChallengeSubmissionInput } from '@/lib/schemas'

const TEST_SUPABASE_URL = 'https://example.supabase.co'

function makeSubmission(overrides: Partial<ChallengeSubmissionInput> = {}): ChallengeSubmissionInput {
  return {
    title: '水火箭测试记录',
    notes: '记录了发射角度和飞行距离。',
    proof_images: [
      'https://example.supabase.co/storage/v1/object/public/project-completions/challenge-submissions/user-123/file.webp',
    ],
    proof_captions: ['发射前的装置'],
    proof_video_url: null,
    is_public: true,
    reference_project_ids: [],
    ...overrides,
  }
}

describe('challenge submission validation', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', TEST_SUPABASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts clean content and current user proof media', () => {
    const payload = makeSubmission({
      proof_video_url: 'https://example.supabase.co/storage/v1/object/public/project-completion-videos/user-123/file.mp4',
    })

    expect(() => validateChallengeSubmissionContent(payload)).not.toThrow()
    expect(() => validateChallengeSubmissionMediaOwnership(payload, 'user-123')).not.toThrow()
  })

  it('rejects unsafe text content', () => {
    expect(() => validateChallengeSubmissionContent(
      makeSubmission({ notes: '加微信领取更多资料' }),
    )).toThrow('挑战作品说明包含不当内容，请修改后重试')
  })

  it('rejects proof images from another user', () => {
    expect(() => validateChallengeSubmissionMediaOwnership(
      makeSubmission({
        proof_images: [
          'https://example.supabase.co/storage/v1/object/public/project-completions/challenge-submissions/user-999/file.webp',
        ],
      }),
      'user-123',
    )).toThrow('挑战作品图片必须使用当前账号上传的文件')
  })

  it('rejects proof videos from another user', () => {
    expect(() => validateChallengeSubmissionMediaOwnership(
      makeSubmission({
        proof_video_url: 'https://example.supabase.co/storage/v1/object/public/project-completion-videos/user-999/file.mp4',
      }),
      'user-123',
    )).toThrow('挑战作品视频必须使用当前账号上传的文件')
  })
})
