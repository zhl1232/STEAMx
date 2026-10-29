import { describe, expect, it } from 'vitest'

import {
  GLOBAL_TUTOR_ENABLED,
  resolveTutorContextFromPath,
  shouldShowGlobalTutor,
} from '@/lib/ai/tutor/resolve-context'

describe('resolveTutorContextFromPath', () => {
  it('resolves the explicit catalog selection and switches course context', () => {
    expect(resolveTutorContextFromPath('/courses', 'course=5')).toEqual({ contextType: 'course', contextId: '5' })
    expect(resolveTutorContextFromPath('/courses', 'course=8')).toEqual({ contextType: 'course', contextId: '8' })
    expect(resolveTutorContextFromPath('/courses', 'course=5&course=8')).toEqual({ contextType: 'global', contextId: '', surface: 'courses' })
    expect(resolveTutorContextFromPath('/courses', 'course=bad')).toEqual({ contextType: 'global', contextId: '', surface: 'courses' })
  })

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

  it('maps legacy community paths onto the create surface', () => {
    expect(resolveTutorContextFromPath('/community')).toEqual({
      contextType: 'global',
      contextId: '',
      surface: 'create',
    })
    expect(resolveTutorContextFromPath('/community/discussion/1')).toEqual({
      contextType: 'global',
      contextId: '',
      surface: 'create',
    })
  })

  it('keeps the playground hub on the generic playground surface', () => {
    expect(resolveTutorContextFromPath('/playground')).toEqual({
      contextType: 'global',
      contextId: '',
      surface: 'playground',
      playgroundGameKey: undefined,
    })
  })

  it('separates playground game pages by concrete game key', () => {
    expect(resolveTutorContextFromPath('/playground/gomoku')).toEqual({
      contextType: 'global',
      contextId: 'playground:gomoku',
      surface: 'playground',
      playgroundGameKey: 'gomoku',
    })

    expect(resolveTutorContextFromPath('/playground/maze')).toEqual({
      contextType: 'global',
      contextId: 'playground:maze',
      surface: 'playground',
      playgroundGameKey: 'maze',
    })

    expect(resolveTutorContextFromPath('/playground/functionwars')).toEqual({
      contextType: 'global',
      contextId: 'playground:functionwars',
      surface: 'playground',
      playgroundGameKey: 'functionwars',
    })
  })
})

describe('shouldShowGlobalTutor', () => {
  it('keeps the sitewide XiaoDi switch enabled', () => {
    expect(GLOBAL_TUTOR_ENABLED).toBe(true)
  })

  it('shows the tutor on routes that resolve a tutor context', () => {
    expect(shouldShowGlobalTutor('/')).toBe(true)
    expect(shouldShowGlobalTutor('/explore')).toBe(true)
    expect(shouldShowGlobalTutor('/nature/species/turdus-merula')).toBe(true)
  })

  it('hides the tutor on routes without a tutor context', () => {
    expect(shouldShowGlobalTutor('/login')).toBe(false)
    expect(shouldShowGlobalTutor('/courses/5')).toBe(false)
  })
})
