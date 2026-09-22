import { describe, expect, it } from 'vitest'
import { announcementId, announcementInput, announcementPatchInput, parseCommunicationInput, welcomeInput } from './validation'

describe('communication input validation', () => {
  it('allows a normal announcement without a CTA', () => {
    expect(parseCommunicationInput(announcementInput, { title: '公告', body: '内容' })).toMatchObject({ action_href: null, level: 'normal' })
  })
  it.each(['https://example.com', '//example.com', '/%2fexample.com', '/\\example.com', '/%0atest'])('rejects unsafe action href %s', (action_href) => {
    expect(() => parseCommunicationInput(announcementInput, { title: '公告', body: '内容', action_href })).toThrow()
  })
  it('keeps omitted fields out of a partial edit', () => {
    expect(parseCommunicationInput(announcementPatchInput, { title: '新标题' })).toEqual({ title: '新标题' })
  })
  it('rejects unsafe welcome contacts and invalid identifiers', () => {
    expect(() => parseCommunicationInput(welcomeInput, { enabled: true, title: '欢迎', body: '内容', contact_href: '//example.com' })).toThrow()
    for (const value of ['0', '-1', 'NaN', '1.2', '9007199254740992']) expect(() => announcementId(value)).toThrow()
  })
})
