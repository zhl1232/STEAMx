import { describe, expect, it } from 'vitest'

import { mapDbProject } from '@/lib/mappers/types'

describe('mapDbProject', () => {
  it('preserves reflection for project cite surfaces', () => {
    const project = mapDbProject({
      id: 12,
      title: '静电章鱼',
      description: '用塑料袋制作一只章鱼。',
      author_id: 'author-1',
      image_url: null,
      category: '科学',
      sub_category_id: null,
      difficulty: 'easy',
      difficulty_stars: 2,
      likes_count: 0,
      views_count: 0,
      comments_count: 0,
      created_at: '2026-08-28T00:00:00.000Z',
      updated_at: '2026-08-28T00:00:00.000Z',
      status: 'approved',
      rejection_reason: null,
      challenge_id: null,
      reflection: '同种电荷相互排斥，摩擦起电后章鱼会飘起来。',
      problem_statement: null,
      iterations: null,
      steam_weights: null,
      tags: ['静电'],
      moderation_state: 'approved',
      recommended_min_age: 6,
      recommended_max_age: null,
      support_level: 'guided',
      classification_status: 'reviewed',
      classification_source: 'manual',
      classification_reviewed_at: null,
      classification_reviewed_by: null,
      classification_revision: 1,
      project_materials: [],
      project_steps: [],
      profiles: { display_name: '小明' },
      sub_categories: null,
    })

    expect(project.reflection).toBe('同种电荷相互排斥，摩擦起电后章鱼会飘起来。')
  })
})
