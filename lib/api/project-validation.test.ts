/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { validateProjectMediaOwnership } from '@/lib/api/project-validation'
import type { CreateProjectInput } from '@/lib/schemas'

const TEST_SUPABASE_URL = 'https://example.supabase.co'

function makeProject(overrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
  return {
    title: '桥梁模型',
    description: '制作一个纸桥并测试承重。',
    category: '工程',
    difficulty_stars: 2,
    status: 'draft',
    materials: [],
    iterations: [],
    steps: [],
    ...overrides,
  }
}

describe('validateProjectMediaOwnership', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', TEST_SUPABASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts trusted local assets and current user uploads', () => {
    expect(() => validateProjectMediaOwnership(
      makeProject({
        image_url: '/projects/default-cover.webp',
        steps: [
          {
            title: '搭建结构',
            image_url: 'https://example.supabase.co/storage/v1/object/public/project-images/steps/user-123/file.webp',
          },
        ],
      }),
      'user-123',
    )).not.toThrow()
  })

  it('rejects project images not owned by the current user', () => {
    expect(() => validateProjectMediaOwnership(
      makeProject({
        image_url: 'https://example.supabase.co/storage/v1/object/public/project-images/covers/user-999/file.webp',
      }),
      'user-123',
    )).toThrow('项目封面图片必须使用当前账号上传的文件或系统默认图片')
  })
})
