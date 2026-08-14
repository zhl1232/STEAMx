import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { getCourseLessonByWorksProjectId } from '@/lib/api/courses'
import { getProjectById } from '@/lib/api/explore-data'
import { createClient } from '@/lib/supabase/server'

// page 侧有 loading.tsx，Suspense 一开始流式输出，之后再调 notFound() 只能换 UI，
// 改不动已经发出去的 200。存在性判断放在 layout 里（属于 shell，先于 Suspense 结算），
// 不存在的项目才会真的返回 404；getProjectById 走 React cache，page 再取一次不额外查库。
export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const numericId = Number((await params).id)
  if (!Number.isInteger(numericId) || numericId <= 0) {
    notFound()
  }

  if (!(await getProjectById(numericId))) {
    // 旧的课程作品链接由 page 302 到课程页，这里不能抢先 404。
    const supabase = await createClient()
    if (!(await getCourseLessonByWorksProjectId(supabase, numericId))) {
      notFound()
    }
  }

  return children
}
