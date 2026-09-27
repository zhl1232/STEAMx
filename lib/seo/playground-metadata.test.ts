import { describe, expect, it } from 'vitest'

import { buildPlaygroundMetadata } from '@/lib/seo/playground-metadata'
import { buildAbsoluteUrl } from '@/lib/seo/site'

describe('buildPlaygroundMetadata', () => {
  it('keeps each public game on its own canonical URL', () => {
    const metadata = buildPlaygroundMetadata('/playground/2048')

    expect(metadata.title).toEqual({ absolute: '2048 在线数字合并游戏 | 创探空间', template: '%s | 创探空间' })
    expect(metadata.alternates?.canonical).toBe(buildAbsoluteUrl('/playground/2048'))
    expect(metadata.openGraph?.url).toBe(buildAbsoluteUrl('/playground/2048'))
  })

  it('supports the nested minesweeper course canonical', () => {
    const metadata = buildPlaygroundMetadata('/playground/minesweeper/course')

    expect(metadata.title).toEqual({ absolute: '扫雷解局学 入门教程 | 创探空间', template: '%s | 创探空间' })
    expect(metadata.alternates?.canonical).toBe(buildAbsoluteUrl('/playground/minesweeper/course'))
  })
})

describe('playground document titles', () => {
  it('are specific (game name + what it is) and unique per game', async () => {
    const { PLAYGROUND_METADATA, PLAYGROUND_METADATA_PATHS } = await import('@/lib/seo/playground-metadata')
    const titles = PLAYGROUND_METADATA_PATHS.map((path) => {
      const title = buildPlaygroundMetadata(path).title as { absolute: string }
      expect(title.absolute.endsWith(' | 创探空间')).toBe(true)
      expect(title.absolute.match(/创探空间/g)).toHaveLength(1)
      // Starts with the real game name but is more than just the bare name.
      expect(title.absolute.startsWith(PLAYGROUND_METADATA[path].title)).toBe(true)
      expect(title.absolute).not.toBe(`${PLAYGROUND_METADATA[path].title} | 创探空间`)
      return title.absolute
    })
    expect(new Set(titles).size).toBe(titles.length)
    expect(buildPlaygroundMetadata('/playground/tangram').title).toMatchObject({ absolute: '七巧板 在线拼图 | 创探空间' })
  })
})
