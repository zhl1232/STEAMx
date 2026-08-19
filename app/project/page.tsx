import type { Metadata } from 'next'

import { ProjectPublishPage } from '@/app/share/page'
import { requirePageUser } from '@/lib/auth/server'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: '创建项目模板',
  description: '整理一个可供别人跟着完成的 STEAM 项目模板。',
  path: '/project',
  noIndex: true,
})

export default async function ProjectIndex() {
  await requirePageUser()

  return <ProjectPublishPage />
}
