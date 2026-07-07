import { notFound } from 'next/navigation'

import { XiaoDiPreviewClient } from './xiaodi-preview-client'

export const metadata = {
  title: '小迪动画预览',
  robots: {
    index: false,
    follow: false,
  },
}

export default function XiaoDiPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }
  return <XiaoDiPreviewClient />
}
