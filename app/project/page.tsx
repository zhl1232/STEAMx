import type { Metadata } from 'next'

import { ProjectPublishPage } from '@/app/share/page'
import { requirePageUser } from '@/lib/auth/server'

export const metadata: Metadata = {
  title: '发布项目',
  description: '整理并提交你的 STEAM 项目作品。',
}

export default async function ProjectIndex() {
  await requirePageUser('/login?next=%2Fproject')

  return <ProjectPublishPage />
}
