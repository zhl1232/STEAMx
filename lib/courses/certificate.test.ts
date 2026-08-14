/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest'

import { formatCertificateDate, getCourseCertificate } from './certificate'

const USER_ID = '11111111-1111-1111-1111-111111111111'

const MILESTONE = {
  completed_at: '2026-08-14T02:00:00.000Z',
  lesson_count_snapshot: 8,
  difficulty_stars_snapshot: 1,
}

const COURSE = { id: 1, title: 'Scratch 少儿编程入门', image_url: '/cover.webp', status: 'approved' }

const VISIBLE = { status: 'approved', is_public: true, moderation_state: 'approved' }

function queryFor(result: { data: unknown; error: null }) {
  const builder: Record<string | symbol, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    maybeSingle: () => queryFor(result),
  }
  return new Proxy(builder, {
    get: (target, prop) => (prop in target ? target[prop] : () => queryFor(result)),
  })
}

function mockClient(rows: {
  milestone?: unknown
  course?: unknown
  works?: unknown[]
}) {
  const from = vi.fn((table: string) => {
    switch (table) {
      case 'user_course_completions':
        return queryFor({ data: rows.milestone ?? null, error: null })
      case 'courses':
        return queryFor({ data: rows.course ?? null, error: null })
      case 'profiles':
        return queryFor({ data: { display_name: '小星', avatar_url: '/a.png' }, error: null })
      case 'completed_projects':
        return queryFor({ data: rows.works ?? [], error: null })
      default:
        return queryFor({ data: null, error: null })
    }
  })
  return { from } as never
}

describe('getCourseCertificate', () => {
  it('returns nothing until the course milestone exists', async () => {
    const certificate = await getCourseCertificate(mockClient({ course: COURSE }), {
      courseId: 1,
      userId: USER_ID,
    })
    expect(certificate).toBeNull()
  })

  it('refuses to issue a certificate for an unpublished course', async () => {
    const certificate = await getCourseCertificate(
      mockClient({ milestone: MILESTONE, course: { ...COURSE, status: 'draft' } }),
      { courseId: 1, userId: USER_ID },
    )
    expect(certificate).toBeNull()
  })

  it('reports the snapshot lesson count, not the current one', async () => {
    const certificate = await getCourseCertificate(
      mockClient({ milestone: MILESTONE, course: COURSE }),
      { courseId: 1, userId: USER_ID },
    )
    expect(certificate).toMatchObject({
      courseTitle: 'Scratch 少儿编程入门',
      learnerName: '小星',
      lessonCount: 8,
      completedAtIso: MILESTONE.completed_at,
      works: [],
    })
  })

  it('collects the learner works from this course into an album', async () => {
    const certificate = await getCourseCertificate(
      mockClient({
        milestone: MILESTONE,
        course: COURSE,
        works: [
          {
            id: 11,
            proof_images: ['/work-11.jpg'],
            completed_at: '2026-07-19T00:00:00.000Z',
            course_lessons: { title: '认识 Scratch' },
            ...VISIBLE,
          },
          { id: 12, proof_images: null, completed_at: null, course_lessons: null, ...VISIBLE },
        ],
      }),
      { courseId: 1, userId: USER_ID },
    )

    expect(certificate?.works).toEqual([
      { id: 11, lessonTitle: '认识 Scratch', image: '/work-11.jpg', completedAt: '2026-07-19T00:00:00.000Z' },
      { id: 12, lessonTitle: '作品 2', image: null, completedAt: MILESTONE.completed_at },
    ])
    expect(certificate?.pendingWorkCount).toBe(0)
  })

  it('keeps works that are not viewable yet out of the album and counts them instead', async () => {
    const certificate = await getCourseCertificate(
      mockClient({
        milestone: MILESTONE,
        course: COURSE,
        works: [
          { id: 21, proof_images: null, completed_at: null, course_lessons: null, ...VISIBLE },
          {
            id: 22,
            proof_images: null,
            completed_at: null,
            course_lessons: null,
            status: 'pending',
            is_public: true,
            moderation_state: 'pending',
          },
          {
            id: 23,
            proof_images: null,
            completed_at: null,
            course_lessons: null,
            status: 'approved',
            is_public: false,
            moderation_state: 'approved',
          },
        ],
      }),
      { courseId: 1, userId: USER_ID },
    )

    expect(certificate?.works.map((work) => work.id)).toEqual([21])
    expect(certificate?.pendingWorkCount).toBe(1)
  })
})

describe('formatCertificateDate', () => {
  it('renders a Chinese date', () => {
    expect(formatCertificateDate('2026-08-14T02:00:00.000Z')).toContain('2026')
  })
})
