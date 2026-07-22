import type {
  Building3DLessonContent,
  CourseLessonStep,
} from '@/lib/courses/types'

const HIDDEN_INTRO_SLIDE_INDICES = new Set([1, 2])
const BUILD_SECTION_START_INDEX = 6
const TRAILING_REFLECTION_SLIDE_COUNT = 3

export type BuildingLessonFlowPage =
  | {
      kind: 'slide'
      sourceIndex: number
      imageUrl: string
      title: string
      description: string
    }
  | {
      kind: 'build'
      stepIndex: number
      title: string
      description: string
    }
  | {
      kind: 'video'
      title: string
      description: string
    }

function hasRealModel(content: Building3DLessonContent | undefined) {
  return Boolean(
    content?.ldrawModelUrl ||
    content?.modelUrl ||
    (Array.isArray(content?.brickInstances) && content.brickInstances.length > 0),
  )
}

function getSlideCopy({
  lessonTitle,
  sourceIndex,
  slideCount,
  videoSlideIndex,
}: {
  lessonTitle: string
  sourceIndex: number
  slideCount: number
  videoSlideIndex?: number
}): Pick<CourseLessonStep, 'title' | 'description'> {
  const trailingStart = Math.max(BUILD_SECTION_START_INDEX, slideCount - TRAILING_REFLECTION_SLIDE_COUNT)

  if (sourceIndex === 0) {
    return {
      title: `认识${lessonTitle}`,
      description: `认识本课主题，看看今天要完成的${lessonTitle}。`,
    }
  }
  if (sourceIndex === 3) {
    return {
      title: '联系生活',
      description: '从生活中的真实对象开始观察、比较和表达。',
    }
  }
  if (sourceIndex === 4) {
    return videoSlideIndex === sourceIndex + 1
      ? { title: '观看动画', description: '观看课程动画，了解作品的结构与搭建思路。' }
      : { title: '观察主题', description: '继续观察主题特征，为结构分析做准备。' }
  }
  if (sourceIndex === 5) {
    return {
      title: '结构分析',
      description: '观察作品各部分的结构、方向和连接方式。',
    }
  }
  if (sourceIndex >= trailingStart) {
    const trailingIndex = sourceIndex - trailingStart
    const trailingCopy = [
      { title: '反思完善', description: '回顾搭建方法，检查结构并完善作品。' },
      { title: '延续分享', description: '把作品放进新的情境，和同伴分享自己的想法。' },
      { title: '完成本课', description: '完成本课并回顾今天的发现与作品。' },
    ]
    return trailingCopy[trailingIndex] ?? {
      title: `课程内容 ${sourceIndex + 1}`,
      description: '继续完成本课内容。',
    }
  }
  if (sourceIndex >= BUILD_SECTION_START_INDEX) {
    const buildPage = sourceIndex - BUILD_SECTION_START_INDEX + 1
    return {
      title: `作品构建 ${buildPage}`,
      description: `按照课件完成第 ${buildPage} 个搭建步骤。`,
    }
  }

  return {
    title: `课程内容 ${sourceIndex + 1}`,
    description: '继续观察并完成本页内容。',
  }
}

export function buildBuildingLessonFlow({
  lessonTitle,
  content,
}: {
  lessonTitle: string
  content: Building3DLessonContent | undefined
}): BuildingLessonFlowPage[] {
  const slideImageUrls = Array.isArray(content?.slideImageUrls)
    ? content.slideImageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : []
  const steps3d = Array.isArray(content?.steps3d) ? content.steps3d : []
  const canReplaceBuildSlides = hasRealModel(content) && steps3d.length > 0
  const buildSectionEnd = Math.max(
    BUILD_SECTION_START_INDEX,
    slideImageUrls.length - TRAILING_REFLECTION_SLIDE_COUNT,
  )
  const pages: BuildingLessonFlowPage[] = []
  let insertedBuildSteps = false

  for (let sourceIndex = 0; sourceIndex < slideImageUrls.length; sourceIndex += 1) {
    if (HIDDEN_INTRO_SLIDE_INDICES.has(sourceIndex)) continue

    if (canReplaceBuildSlides && sourceIndex === BUILD_SECTION_START_INDEX) {
      pages.push(
        ...steps3d.map((step, stepIndex) => ({
          kind: 'build' as const,
          stepIndex,
          title: step.title,
          description: step.description,
        })),
      )
      insertedBuildSteps = true
    }

    if (
      canReplaceBuildSlides &&
      sourceIndex >= BUILD_SECTION_START_INDEX &&
      sourceIndex < buildSectionEnd
    ) {
      continue
    }

    const copy = getSlideCopy({
      lessonTitle,
      sourceIndex,
      slideCount: slideImageUrls.length,
      videoSlideIndex: content?.videoSlideIndex,
    })
    pages.push({
      kind: 'slide',
      sourceIndex,
      imageUrl: slideImageUrls[sourceIndex],
      ...copy,
    })
  }

  if (canReplaceBuildSlides && !insertedBuildSteps) {
    pages.push(
      ...steps3d.map((step, stepIndex) => ({
        kind: 'build' as const,
        stepIndex,
        title: step.title,
        description: step.description,
      })),
    )
  }

  if (pages.length === 0 && content?.videoUrl) {
    pages.push({
      kind: 'video',
      title: '观看动画',
      description: '观看课程动画，了解作品的结构与搭建思路。',
    })
  }

  return pages
}

export function buildBuildingLessonDisplaySteps({
  lessonTitle,
  content,
}: {
  lessonTitle: string
  content: Building3DLessonContent | undefined
}): CourseLessonStep[] {
  return buildBuildingLessonFlow({ lessonTitle, content }).map((page) => ({
    title: page.title,
    description: page.description,
  }))
}
