import gomokuPreviews from './gomoku-previews.json'

export interface LessonPreviewSource {
  title: string
  lesson_type?: string | null
  finished_image_url?: string | null
  scratch_curriculum_key?: string | null
  scratch_lesson_key?: string | null
  playground_game_key?: string | null
}

/** Small projections only; never load a workspace to display its catalog image. */
export function lessonPreviewImage(lesson: LessonPreviewSource): string | null {
  const finished = lesson.finished_image_url?.trim()
  if (finished) return finished
  if (lesson.lesson_type === 'scratch' && lesson.scratch_curriculum_key === 'scratch-original-v1'
    && /^s0[1-6]-l0[1-8]$/.test(lesson.scratch_lesson_key ?? '')) {
    return `/assets/course-previews/scratch/${lesson.scratch_lesson_key}.webp`
  }
  if (lesson.lesson_type === 'playground' && lesson.playground_game_key === 'gomoku') {
    return (gomokuPreviews as Record<string, string>)[lesson.title] ?? null
  }
  return null
}

export const LESSON_PREVIEW_PROJECTION = 'lesson_type, finished_image_url:content->building3d->>finishedImageUrl, scratch_curriculum_key:content->scratch->>curriculumKey, scratch_lesson_key:content->scratch->>lessonKey, playground_game_key:content->playground->>gameKey'
