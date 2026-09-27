import React from 'react'
import type { Metadata } from 'next'
import { LdrawPreviewWorkspace } from '@/components/features/ldraw/ldraw-preview-workspace'
import { buildSegmentTitle } from '@/lib/seo/title'

export const metadata: Metadata = {
  title: buildSegmentTitle('LDraw 3D 预览工作台'),
  description: '大颗粒积木 LDraw 源模型与搭建步骤实时 3D 预览及装配调试工作台',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LdrawPreviewPage() {
  return <LdrawPreviewWorkspace />
}
