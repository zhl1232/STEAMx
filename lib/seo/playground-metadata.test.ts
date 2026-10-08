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

describe('playground structured data', () => {
  it('ties every game JSON-LD WebPage to the same absolute canonical URL', async () => {
    const { PLAYGROUND_METADATA_PATHS, buildPlaygroundJsonLd } = await import('@/lib/seo/playground-metadata')
    for (const path of PLAYGROUND_METADATA_PATHS) {
      const canonical = buildPlaygroundMetadata(path).alternates?.canonical
      const [webPage, breadcrumb] = buildPlaygroundJsonLd(path) as unknown as [
        { url: string; '@id': string; description: string },
        { itemListElement: Array<{ item: string }> },
      ]
      expect(webPage.url).toBe(canonical)
      expect(webPage['@id']).toBe(`${canonical}#webpage`)
      expect(webPage.description).toBe(buildPlaygroundMetadata(path).description)
      expect(breadcrumb.itemListElement.at(-1)?.item).toBe(canonical)
      expect(breadcrumb.itemListElement[1]?.item).toBe(buildAbsoluteUrl('/playground'))
    }
  })

  it('describes the course as a WebPage about the actual minesweeper game', async () => {
    const { buildPlaygroundJsonLd } = await import('@/lib/seo/playground-metadata')
    const [course] = buildPlaygroundJsonLd('/playground/minesweeper/course')
    expect(course).toMatchObject({
      '@type': 'WebPage',
      name: '扫雷解局学 入门教程',
      url: buildAbsoluteUrl('/playground/minesweeper/course'),
      about: {
        '@type': 'Game',
        name: '扫雷',
        url: buildAbsoluteUrl('/playground/minesweeper'),
      },
    })
  })

  it('nests the minesweeper course under the minesweeper game in breadcrumbs', async () => {
    const { buildPlaygroundJsonLd } = await import('@/lib/seo/playground-metadata')
    const [, breadcrumb] = buildPlaygroundJsonLd('/playground/minesweeper/course') as unknown as [
      unknown,
      { itemListElement: Array<{ name: string; item: string }> },
    ]
    expect(breadcrumb.itemListElement.map((item) => item.name)).toEqual(['首页', '游乐场', '扫雷', '扫雷解局学'])
  })
})

describe('playground descriptions', () => {
  it('are unique and substantive enough to tell games apart', async () => {
    const { PLAYGROUND_METADATA, PLAYGROUND_METADATA_PATHS } = await import('@/lib/seo/playground-metadata')
    const descriptions = PLAYGROUND_METADATA_PATHS.map((path) => PLAYGROUND_METADATA[path].description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
    for (const description of descriptions) {
      expect(description.length).toBeGreaterThanOrEqual(50)
      expect(description.length).toBeLessThanOrEqual(120)
    }
  })
})
