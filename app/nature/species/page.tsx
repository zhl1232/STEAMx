import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

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
  const topic = normalizeTopic(params.topic)
  if (topic !== 'all') {
    const redirectParams = new URLSearchParams()
    if (params.q?.trim()) redirectParams.set('q', params.q.trim())
    const status = normalizeStatus(params.status)
    if (status !== 'all') redirectParams.set('status', status)
    const search = redirectParams.toString()
    permanentRedirect(`/nature/${topic}${search ? `?${search}` : ''}`)
  }

  const atlas = await getSpeciesAtlas()
  const requestedStatus = normalizeStatus(params.status)
  const initialStatus = atlas.viewer.progressState === 'ready' ? requestedStatus : 'all'

  return (
    <SpeciesAtlas
      initialData={atlas}
      initialQuery={params.q ?? ''}
      initialTopic={topic}
      initialStatus={initialStatus}
      requestedStatus={requestedStatus}
    />
  )
}
