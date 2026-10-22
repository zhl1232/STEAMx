import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isDevelopmentMode } from '@/lib/development-only'

import { buildPageMetadata } from '@/lib/seo/metadata'
import { BRAND_FULL_NAME } from '@/lib/brand'

export function generateMetadata(): Metadata {
  if (!isDevelopmentMode()) notFound()
  return buildPageMetadata({
    title: '数据迁移说明',
    description: `${BRAND_FULL_NAME}数据库迁移说明，仅供项目维护使用。`,
    path: '/migrate',
    noIndex: true,
  })
}

export default function MigrateLayout({ children }: { children: React.ReactNode }) {
  if (!isDevelopmentMode()) notFound()
  return children
}
