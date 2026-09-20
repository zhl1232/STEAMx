import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../supabase/migrations/20260920180000_remove_interaction_confirmation_gate.sql', import.meta.url),
  'utf8',
)

describe('interaction access migration', () => {
  it('removes the confirmation predicate while retaining safety predicates', () => {
    expect(migration).not.toMatch(/age_confirmed_at\s+IS\s+NOT\s+NULL/i)
    expect(migration).toContain("p.safety_status <> 'banned'")
    expect(migration).toContain('p.interaction_restricted IS NOT TRUE')
    expect(migration).toContain('FROM public.safety_actions sa')
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.current_user_can_interact(text) TO service_role")
  })
})
