import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { buildSegmentTitle } from '@/lib/seo/title'


export const metadata: Metadata = {
  title: buildSegmentTitle('材料包商城'),
  robots: { index: false, follow: false },
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  return children
}
