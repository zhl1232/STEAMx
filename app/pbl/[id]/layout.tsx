import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/seo/json-ld'
import { getPublicPblChallenge } from '@/lib/api/pbl-challenges'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { buildChallengeJsonLd } from '@/lib/seo/json-ld'

type PblDetailLayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

function parseChallengeId(rawId: string) {
  const id = Number(rawId)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function generateMetadata({ params }: PblDetailLayoutProps): Promise<Metadata> {
  const { id: rawId } = await params
  const challengeId = parseChallengeId(rawId)
  const challenge = challengeId ? await getPublicPblChallenge(challengeId) : null

  if (!challenge) {
    return {
      title: '挑战未找到',
      description: '项目挑战不存在或已经不可见。',
      robots: { index: false, follow: false },
    }
  }

  return buildPageMetadata({
    title: challenge.title,
    description: challenge.description.slice(0, 160) || '记录探索过程，完成项目挑战并提交作品。',
    path: `/pbl/${challenge.id}`,
    image: challenge.imageUrl || undefined,
    type: 'article',
    keywords: [challenge.title, 'PBL挑战', '项目式学习', ...challenge.tags],
  })
}

export default async function PblDetailLayout({ children, params }: PblDetailLayoutProps) {
  const { id: rawId } = await params
  const challengeId = parseChallengeId(rawId)
  const challenge = challengeId ? await getPublicPblChallenge(challengeId) : null

  if (!challengeId || !challenge) {
    notFound()
  }

  return (
    <>
      <JsonLd
        data={buildChallengeJsonLd({
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          image: challenge.imageUrl,
          classification: challenge.classification,
        })}
      />
      {children}
    </>
  )
}
