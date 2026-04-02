"use client"

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { RatingStars } from './rating-stars'
import { Star } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import Link from 'next/link'

interface Submission {
  id: number
  title: string
  description: string | null
  image_url: string | null
  author_id: string
  category: string | null
  difficulty_stars: number
  reflection: string | null
  problem_statement: string | null
  profiles: { display_name: string | null; avatar_url: string | null } | null
  rating_summary: { avg_score: number; rating_count: number }
}

interface SubmissionGalleryProps {
  challengeId: number
  challengeType: 'timed' | 'evergreen'
}

export function SubmissionGallery({ challengeId, challengeType }: SubmissionGalleryProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedRating, setExpandedRating] = useState<number | null>(null)
  const { user } = useAuth()

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/challenges/${challengeId}/submissions`)
    if (res.ok) {
      const data = await res.json()
      setSubmissions(data.submissions || [])
    }
    setIsLoading(false)
  }, [challengeId])

  useEffect(() => {
    setIsLoading(true)
    void fetchSubmissions()
  }, [fetchSubmissions])

  if (isLoading) {
    return <div className="surface-subtle px-6 py-10 text-center text-muted-foreground">加载作品中...</div>
  }

  if (submissions.length === 0) {
    return (
      <div className="surface-subtle px-6 py-12 text-center text-muted-foreground">
        <p className="text-lg">还没有作品提交</p>
        <p className="text-sm mt-1">成为第一个提交作品的人吧！</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">
        已提交作品 ({submissions.length})
      </h3>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {submissions.map((sub, idx) => {
          const isMine = user?.id === sub.author_id
          const isFeatured = sub.rating_summary.avg_score >= 4.0
          return (
            <article key={sub.id} className="surface-subtle overflow-hidden">
              <div className="relative">
                {sub.image_url && (
                  <div className="relative aspect-video">
                    <OptimizedImage src={sub.image_url} alt={sub.title} fill variant="cover" className="object-cover" />
                  </div>
                )}
                {challengeType === 'timed' && idx < 3 && (
                  <Badge className="absolute top-2 left-2 bg-yellow-500 text-white">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} 第{idx + 1}名
                  </Badge>
                )}
                {isFeatured && challengeType === 'evergreen' && (
                  <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">精选</Badge>
                )}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/project/${sub.id}`} className="font-medium hover:text-primary transition-colors">
                      {sub.title}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {(sub.profiles as { display_name: string | null })?.display_name || '未知用户'}
                    </p>
                  </div>
                  {sub.rating_summary.rating_count > 0 && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{sub.rating_summary.avg_score}</span>
                      <span className="text-muted-foreground">({sub.rating_summary.rating_count})</span>
                    </div>
                  )}
                </div>

                {sub.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{sub.description}</p>
                )}

                {/* Rating interaction */}
                {!isMine && user && (
                  <div>
                    {expandedRating === sub.id ? (
                      <RatingStars
                        projectId={sub.id}
                        onRated={() => {
                          setExpandedRating(null)
                          void fetchSubmissions()
                        }}
                      />
                    ) : (
                      <button
                        className="text-sm text-primary hover:underline"
                        onClick={() => setExpandedRating(sub.id)}
                      >
                        评分此作品
                      </button>
                    )}
                  </div>
                )}

                {isMine && (
                  <p className="text-xs text-muted-foreground italic">这是你的作品</p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
