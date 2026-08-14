/** @vitest-environment node */

import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/courses/ldraw-bom/route'
import type { LdrawBom } from '@/lib/utils/ldraw-bom'

function request(query: string) {
  return new NextRequest(`http://localhost/api/courses/ldraw-bom${query}`)
}

describe('GET /api/courses/ldraw-bom', () => {
  it('返回课时模型的分步零件清单与总数', async () => {
    const response = await GET(request('?model=3-hu-die.mpd'))
    expect(response.status).toBe(200)

    const bom = (await response.json()) as LdrawBom
    expect(bom.stepCount).toBe(10)
    expect(bom.partCount).toBe(35)
    expect(bom.steps[0]).toMatchObject({ stepIndex: 0, partCount: 2 })
    expect(bom.entries[0]).toMatchObject({ partName: '2×4 积木', colorName: '红色' })
    expect(response.headers.get('Cache-Control')).toContain('max-age=3600')
  })

  it('拒绝非法模型名与路径穿越', async () => {
    for (const query of ['', '?model=', '?model=evil.txt', '?model=../secrets.mpd']) {
      const response = await GET(request(query))
      expect(response.status).toBe(400)
    }
  })

  it('模型不存在时返回 404', async () => {
    const response = await GET(request('?model=not-a-real-lesson.mpd'))
    expect(response.status).toBe(404)
  })
})
