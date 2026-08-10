/** @vitest-environment node */

import { describe, expect, it } from 'vitest'

import { POST } from '@/app/api/comments/route'

describe('POST /api/comments', () => {
  it('retires new project comments and directs users to a work', async () => {
    const response = await POST()

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      error: '项目评论已停用，请到具体作品下留言',
      code: 'PROJECT_COMMENTS_RETIRED',
    })
  })
})
