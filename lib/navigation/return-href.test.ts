import { beforeEach, describe, expect, it } from 'vitest'

import {
  RETURN_HREF_STORAGE_KEY,
  isReturnTrackedPath,
  readReturnHrefRaw,
  rememberReturnHref,
  resolveReturnHref,
} from './return-href'

describe('return href (replaces ?from=)', () => {
  beforeEach(() => sessionStorage.clear())

  it('remembers where the user came from per target path', () => {
    rememberReturnHref('/nature/observations/13', '/')
    rememberReturnHref('/nature/species/osmoderma-barnabita', '/nature/insects?q=%E9%87%91%E9%BE%9F')
    const raw = readReturnHrefRaw()
    expect(resolveReturnHref(raw, '/nature/observations/13', '/nature/observations')).toBe('/')
    expect(resolveReturnHref(raw, '/nature/species/osmoderma-barnabita', '/nature/species')).toBe(
      '/nature/insects?q=%E9%87%91%E9%BE%9F',
    )
    expect(resolveReturnHref(raw, '/nature/observations/99', '/nature/observations')).toBe('/nature/observations')
  })

  it('refuses unsafe or self-referencing sources', () => {
    rememberReturnHref('/nature/observations/1', 'https://evil.example/')
    rememberReturnHref('/nature/observations/2', '/nature/../login')
    rememberReturnHref('/nature/observations/3', '/nature/observations/3?x=1')
    expect(readReturnHrefRaw()).toBeNull()
  })

  it('ignores tampered storage entries', () => {
    sessionStorage.setItem(RETURN_HREF_STORAGE_KEY, JSON.stringify([{ path: '/nature/observations/1', from: '//evil.example' }]))
    expect(resolveReturnHref(readReturnHrefRaw(), '/nature/observations/1', '/nature/observations')).toBe('/nature/observations')
  })

  it('only tracks sections that used from=', () => {
    expect(isReturnTrackedPath('/nature/observations/1')).toBe(true)
    expect(isReturnTrackedPath('/project/1')).toBe(false)
  })
})
