import type { Metadata } from 'next'

import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: '申请成为审核员',
  description: '申请加入 STEAM 探索审核队伍，帮助维护社区内容质量。',
  path: '/moderator/apply',
  noIndex: true,
})

export default function ModeratorApplyLayout({ children }: { children: React.ReactNode }) {
  return children
}
