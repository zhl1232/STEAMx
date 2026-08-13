import type { Metadata } from 'next'

import { getSpeciesAtlas } from '@/lib/api/nature-observation-atlas'
import {
  type SpeciesAtlasStatusFilter,
  type SpeciesAtlasTopicFilter,
  isSpeciesAtlasTopicKey,
} from '@/lib/nature-species-atlas'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { SpeciesAtlas } from './species-atlas'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildPageMetadata({
  title: '物种图鉴',
  description: '浏览鸟类、昆虫和植物物种图鉴，查看自然观察记录。',
  path: '/nature/species',
  keywords: ['物种图鉴', '自然观察', '物种识别', '观察进度'],
})

interface SpeciesPageProps {
  searchParams: Promise<{ q?: string; topic?: string; status?: string }>
}

function normalizeTopic(value: string | undefined): SpeciesAtlasTopicFilter {
  return isSpeciesAtlasTopicKey(value) ? value : 'all'
}

function normalizeStatus(value: string | undefined): SpeciesAtlasStatusFilter {
  return value === 'observed' || value === 'unobserved' ? value : 'all'
}

export default async function SpeciesPage({ searchParams }: SpeciesPageProps) {
  const params = await searchParams
  const atlas = await getSpeciesAtlas()
  const requestedStatus = normalizeStatus(params.status)
  const initialStatus = atlas.viewer.progressState === 'ready' ? requestedStatus : 'all'

  return (
    <SpeciesAtlas
      initialData={atlas}
      initialQuery={params.q ?? ''}
      initialTopic={normalizeTopic(params.topic)}
      initialStatus={initialStatus}
      requestedStatus={requestedStatus}
    />
  )
}
