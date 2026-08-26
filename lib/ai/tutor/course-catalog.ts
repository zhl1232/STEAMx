import type { SupabaseClient } from '@supabase/supabase-js'

import { getContentClassificationSettings } from '@/lib/content-classification'
import type { Database } from '@/lib/supabase/types'

export type TutorCourseRef = {
  id: number
  title: string
  tags: string[] | null
}

function compact(value: string, max = 40) {
  const text = value.trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 拉取已上架技能课程，供小迪全站推荐与 [course:id|标题] 引用。 */
export async function fetchTutorRecommendableCourses(
  supabase: SupabaseClient<Database>,
  limit = 20,
): Promise<TutorCourseRef[]> {
  const classificationSettings = await getContentClassificationSettings()
  let query = supabase
    .from('courses')
    .select('id, title, tags')
    .eq('status', 'approved')
  if (classificationSettings.enforcementEnabled) {
    query = query.eq('classification_status', 'reviewed')
  }
  const { data, error } = await query
    .order('sort_order', { ascending: true })
    .limit(limit)

  if (error || !data?.length) return []
  return data.filter((row): row is TutorCourseRef => typeof row.id === 'number' && typeof row.title === 'string')
}

export function formatTutorCourseCatalog(courses: TutorCourseRef[]) {
  if (!courses.length) return ''

  const lines = courses.map((course) => {
    const tagHint = (course.tags ?? []).slice(0, 3).filter(Boolean).join('·')
    return `- [course:${course.id}|${compact(course.title)}]${tagHint ? `（${tagHint}）` : ''}`
  })

  return [
    '【可推荐的站内课程】',
    '学生问「有没有对应课程 / 想系统学某主题」时，从下面挑 1 门推荐；引用时必须原样保留方括号格式（如 [course:12|课程名]），界面会显示可点击入口。不要说列表里已有的课「站内没有」，也不要推荐列表之外的课程或改写格式：',
    ...lines,
  ].join('\n')
}

export function findTutorCourseByTitle(courses: TutorCourseRef[], title: string) {
  return courses.find((course) => course.title === title) ?? null
}
