import { describe, expect, it } from 'vitest'

import {
  fetchTutorRecommendableCourses,
  findTutorCourseByTitle,
  formatTutorCourseCatalog,
} from '@/lib/ai/tutor/course-catalog'

describe('formatTutorCourseCatalog', () => {
  it('formats clickable course tags for tutor replies', () => {
    const catalog = formatTutorCourseCatalog([
      { id: 88, title: '五子棋博弈论入门', tags: ['五子棋', '博弈论'] },
    ])

    expect(catalog).toContain('【可推荐的站内课程】')
    expect(catalog).toContain('[course:88|五子棋博弈论入门]')
    expect(catalog).toContain('不要说列表里已有的课「站内没有」')
  })

  it('returns empty string when there are no courses', () => {
    expect(formatTutorCourseCatalog([])).toBe('')
  })
})

describe('findTutorCourseByTitle', () => {
  it('finds a course by exact title', () => {
    const courses = [{ id: 88, title: '五子棋博弈论入门', tags: null }]
    expect(findTutorCourseByTitle(courses, '五子棋博弈论入门')?.id).toBe(88)
    expect(findTutorCourseByTitle(courses, '其他')).toBeNull()
  })
})

describe('fetchTutorRecommendableCourses', () => {
  it('returns approved courses from supabase', async () => {
    const supabase = {
      from() {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          order() {
            return this
          },
          limit: async () => ({
            data: [{ id: 1, title: 'Scratch 入门', tags: ['编程'] }],
            error: null,
          }),
        }
      },
    }

    await expect(fetchTutorRecommendableCourses(supabase as never)).resolves.toEqual([
      { id: 1, title: 'Scratch 入门', tags: ['编程'] },
    ])
  })
})
