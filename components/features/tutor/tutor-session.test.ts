import { describe, expect, it } from 'vitest'

import { buildTutorChatParams, tutorSessionQueryKey } from '@/components/features/tutor/tutor-session'

describe('tutor session helpers', () => {
  it('includes the playground game key in chat params and query cache keys', () => {
    const input = {
      userId: 'user-1',
      contextType: 'global' as const,
      contextId: 'playground:maze',
      surface: 'playground' as const,
      playgroundGameKey: 'maze' as const,
    }

    const params = buildTutorChatParams(input)

    expect(params.get('contextType')).toBe('global')
    expect(params.get('contextId')).toBe('playground:maze')
    expect(params.get('surface')).toBe('playground')
    expect(params.get('gameKey')).toBe('maze')
    expect(tutorSessionQueryKey(input)).toContain('maze')
  })
})
