import type { Metadata } from 'next'

import { ContentClassificationReview } from '@/components/admin/content-classification-review'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'

export const metadata: Metadata = {
  title: '内容分级审核 | 管理后台',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ContentClassificationsPage() {
  return (
    <div className="page-shell pt-6 pb-24 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader title="内容分级审核" fallbackHref="/admin" />
      </div>

      <section className="surface-panel overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:px-8 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:backdrop-blur-0">
        <ContentClassificationReview />
      </section>
    </div>
  )
}
