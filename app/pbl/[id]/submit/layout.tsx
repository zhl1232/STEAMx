import type { Metadata } from 'next'

import { buildPageMetadata } from '@/lib/seo/metadata'

type PblSubmitLayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PblSubmitLayoutProps): Promise<Metadata> {
  const { id } = await params

  return buildPageMetadata({
    title: '提交挑战作品',
    description: '整理探索过程和证据，提交你的项目挑战作品。',
    path: `/pbl/${id}/submit`,
    noIndex: true,
  })
}

export default function PblSubmitLayout({ children }: PblSubmitLayoutProps) {
  return children
}
