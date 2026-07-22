import { describe, expect, it } from 'vitest'

import {
  buildBuildingLessonDisplaySteps,
  buildBuildingLessonFlow,
} from '@/lib/courses/building-lesson-flow'
import type { Building3DLessonContent } from '@/lib/courses/types'

function makeSlides(count: number) {
  return Array.from({ length: count }, (_, index) => `/slides/slide-${index + 1}.webp`)
}

function makeContent(overrides: Partial<Building3DLessonContent> = {}): Building3DLessonContent {
  return {
    parts: [],
    steps3d: [],
    ...overrides,
  }
}

describe('buildBuildingLessonFlow', () => {
  it('removes teaching-goal and teaching-flow pages from image-only lessons', () => {
    const pages = buildBuildingLessonFlow({
      lessonTitle: '长颈鹿',
      content: makeContent({ slideImageUrls: makeSlides(18) }),
    })

    expect(pages).toHaveLength(16)
    expect(pages.filter((page) => page.kind === 'slide').map((page) => page.sourceIndex))
      .toEqual([0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
  })

  it('replaces the complete work-construction image section with real 3D steps', () => {
    const pages = buildBuildingLessonFlow({
      lessonTitle: '长颈鹿',
      content: makeContent({
        slideImageUrls: makeSlides(18),
        ldrawModelUrl: '/courses/ldraw/giraffe.mpd',
        steps3d: Array.from({ length: 8 }, (_, index) => ({
          title: `3D 搭建 ${index + 1}`,
          description: `完成第 ${index + 1} 步`,
          partIds: [],
        })),
      }),
    })

    expect(pages.map((page) => page.kind)).toEqual([
      'slide', 'slide', 'slide', 'slide',
      'build', 'build', 'build', 'build', 'build', 'build', 'build', 'build',
      'slide', 'slide', 'slide',
    ])
    expect(pages.filter((page) => page.kind === 'slide').map((page) => page.sourceIndex))
      .toEqual([0, 3, 4, 5, 15, 16, 17])
    expect(pages.filter((page) => page.kind === 'build').map((page) => page.stepIndex))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('uses 3D steps as the whole flow when a modeled lesson has no slide images', () => {
    const pages = buildBuildingLessonFlow({
      lessonTitle: '模型课',
      content: makeContent({
        modelUrl: '/models/lesson.glb',
        steps3d: [
          { title: '搭建底座', description: '先搭底座', partIds: [] },
          { title: '完成顶部', description: '再搭顶部', partIds: [] },
        ],
      }),
    })

    expect(pages.map((page) => page.kind)).toEqual(['build', 'build'])
  })

  it('keeps sidebar steps aligned with the unified course flow', () => {
    const steps = buildBuildingLessonDisplaySteps({
      lessonTitle: '长颈鹿',
      content: makeContent({
        slideImageUrls: makeSlides(18),
        ldrawModelUrl: '/courses/ldraw/giraffe.mpd',
        steps3d: [{ title: '搭建四肢', description: '完成四肢', partIds: [] }],
      }),
    })

    expect(steps.map((step) => step.title)).toEqual([
      '认识长颈鹿',
      '联系生活',
      '观察主题',
      '结构分析',
      '搭建四肢',
      '反思完善',
      '延续分享',
      '完成本课',
    ])
  })
})
