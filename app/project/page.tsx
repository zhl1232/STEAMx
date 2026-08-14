import type { Metadata } from 'next'

import { ProjectPublishPage } from '@/app/share/page'
import { requirePageUser } from '@/lib/auth/server'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: '发布项目',
  description: '整理并提交你的 STEAM 项目作品。',
  path: '/project',
  noIndex: true,
})

export default async function ProjectIndex() {
  await requirePageUser()

  return <ProjectPublishPage />
}
