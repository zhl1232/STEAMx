import { describe, expect, it } from 'vitest'

import { pickFeaturedPblChallenge } from '@/lib/api/pbl-challenges'

describe('pickFeaturedPblChallenge', () => {
  it('prefers the newest timed challenge over evergreen rows', () => {
    const featured = pickFeaturedPblChallenge([
      {
        id: 8,
        title: '长期积木挑战',
        description: '慢慢搭。',
        image_url: '/evergreen.webp',
        challenge_type: 'evergreen',
      },
      {
        id: 3,
        title: '鸡蛋快递保护舱挑战',
        description: '用有限材料保护一枚鸡蛋。',
        image_url: '/egg.webp',
        challenge_type: 'timed',
      },
    ])

    expect(featured).toEqual({
      id: 3,
      title: '鸡蛋快递保护舱挑战',
      summary: '用有限材料保护一枚鸡蛋。',
      imageUrl: '/egg.webp',
    })
  })

  it('falls back to evergreen, then any active row', () => {
    expect(
      pickFeaturedPblChallenge([
        {
          id: 8,
          title: '长期积木挑战',
          description: null,
          image_url: null,
          challenge_type: 'evergreen',
        },
      ]),
    ).toMatchObject({
      id: 8,
      title: '长期积木挑战',
      summary: '每周开放 · 提交过程记录和作品成果',
      imageUrl: '',
    })
  })

  it('returns null when there is no active challenge', () => {
    expect(pickFeaturedPblChallenge([])).toBeNull()
  })
})
