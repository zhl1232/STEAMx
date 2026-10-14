import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_WELCOME_SETTINGS } from '@/lib/communications/types'
import { PLATFORM_SUPPORT_HREF } from '@/lib/product/support'

const read = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const seed = read('20260922120000_platform_communications.sql')
const brand = read('20261004100000_refresh_welcome_brand_copy.sql')
const latest = read('20261013210000_simplify_mobile_onboarding.sql')
const statements = latest.replace(/^--.*$/gm, '')

describe('mobile onboarding migration', () => {
  it('covers both actual legacy defaults without editing historical migrations', () => {
    const original = seed.match(/body text NOT NULL DEFAULT '([^']+)'/)?.[1]
    const previous = brand.match(/SET body = '([^']+)'/)?.[1]
    expect(original).toBeTruthy()
    expect(previous).toBeTruthy()
    for (const value of [original, previous]) {
      expect(latest).toContain(`'${value}'`)
      expect(latest).toContain(`quote_literal('${value}') || '::text'`)
    }
    expect(latest).toContain('WHERE id = true AND body IN (')
  })
  it('uses the new code defaults for rows and guarded column defaults', () => {
    expect(latest).toContain(`SET body = '${DEFAULT_WELCOME_SETTINGS.body}'`)
    expect(latest).toContain(`ALTER COLUMN body SET DEFAULT '${DEFAULT_WELCOME_SETTINGS.body}'`)
    expect(latest).toContain(`SET contact_href = '${PLATFORM_SUPPORT_HREF}'`)
    expect(latest).toContain(`ALTER COLUMN contact_href SET DEFAULT '${PLATFORM_SUPPORT_HREF}'`)
    expect(latest).toContain("contact_href IN ('/about#contact', '/settings/about#contact')")
    expect(latest.match(/IF EXISTS \(/g)).toHaveLength(2)
  })
  it('does not reset activation, re-deliver, or alter announcements/history', () => {
    const updates = statements.match(/UPDATE public\.platform_welcome_settings[\s\S]*?;/g) ?? []
    expect(updates).toHaveLength(2)
    expect(updates.every(sql => sql.includes('WHERE id = true AND'))).toBe(true)
    expect(statements).not.toMatch(/\b(INSERT|DELETE|TRUNCATE|activated_after|communication_ledger|notifications|platform_announcements|CREATE\s+TRIGGER)\b/i)
  })
})
