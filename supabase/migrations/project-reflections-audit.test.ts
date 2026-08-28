import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260828140000_fill_project_reflections.sql'),
  'utf8',
)

describe('project reflection backfill migration', () => {
  it('keeps the one-time backfill transactional and service-role scoped', () => {
    expect(migration).toContain('BEGIN;')
    expect(migration).toContain("SET LOCAL request.jwt.claim.role = 'service_role';")
    expect(migration.trimEnd()).toMatch(/COMMIT;$/)
  })

  it('has one unique explicit project id and empty-value guard per backfill', () => {
    const whereClauses = migration.match(/^WHERE .*$/gm) ?? []
    const ids = whereClauses.map((clause) => Number(clause.match(/id = (\d+);$/)?.[1]))

    expect(whereClauses).toHaveLength(214)
    expect(ids).toHaveLength(214)
    expect(ids.every((id) => Number.isInteger(id) && id > 0)).toBe(true)
    expect(new Set(ids).size).toBe(214)
    expect(whereClauses.every((clause) => clause.includes("reflection IS NULL OR btrim(reflection) = ''"))).toBe(true)
  })
})
