import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { buildSegmentTitle } from '@/lib/seo/title'
import { isStoreCatalogVisible } from '@/lib/store/config'

export function generateMetadata(): Metadata {
  return {
    title: buildSegmentTitle(isStoreCatalogVisible() ? '材料包商城' : '页面未找到'),
    robots: { index: false, follow: false },
  }
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  return children
}
