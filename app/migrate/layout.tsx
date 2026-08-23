import type { Metadata } from 'next'

import { buildPageMetadata } from '@/lib/seo/metadata'
import { BRAND_FULL_NAME } from '@/lib/brand'

export const metadata: Metadata = buildPageMetadata({
  title: '数据迁移说明',
  description: `${BRAND_FULL_NAME}数据库迁移说明，仅供项目维护使用。`,
  path: '/migrate',
  noIndex: true,
})

export default function MigrateLayout({ children }: { children: React.ReactNode }) {
  return children
}
