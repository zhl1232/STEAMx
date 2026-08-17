import { describe, expect, it } from 'vitest'

import { buildPlaygroundMetadata } from '@/lib/seo/playground-metadata'

describe('buildPlaygroundMetadata', () => {
  it('keeps each public game on its own canonical URL', () => {
    const metadata = buildPlaygroundMetadata('/playground/2048')

    expect(metadata.title).toBe('2048')
    expect(metadata.alternates?.canonical).toBe('/playground/2048')
    expect(metadata.openGraph?.url).toBe('/playground/2048')
  })

  it('supports the nested minesweeper course canonical', () => {
    const metadata = buildPlaygroundMetadata('/playground/minesweeper/course')

    expect(metadata.title).toBe('扫雷解局学')
    expect(metadata.alternates?.canonical).toBe('/playground/minesweeper/course')
  })
})
