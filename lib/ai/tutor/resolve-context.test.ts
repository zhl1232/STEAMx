import { describe, expect, it } from 'vitest'

import { resolveTutorContextFromPath } from '@/lib/ai/tutor/resolve-context'

describe('resolveTutorContextFromPath', () => {
  it('resolves species detail pages by slug', () => {
    expect(resolveTutorContextFromPath('/nature/species/turdus-merula')).toEqual({
      contextType: 'species',
      contextId: 'turdus-merula',
    })
  })

  it('keeps species list pages on the generic nature surface', () => {
    expect(resolveTutorContextFromPath('/nature/species')).toEqual({
      contextType: 'global',
      contextId: '',
      surface: 'nature',
    })
  })

  it('prefers observation records over species pages', () => {
    expect(resolveTutorContextFromPath('/nature/observations/42')).toEqual({
      contextType: 'observation',
      contextId: '42',
    })
  })
})
