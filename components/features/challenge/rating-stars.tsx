"use client"

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface RatingStarsProps {
  projectId: number
  initialRating?: { creativity: number; practicality: number; technical: number; reflectionDepth: number } | null
  disabled?: boolean
  onRated?: () => void
}

const DIMENSIONS = [
  { key: 'creativity', label: '创意性' },
  { key: 'practicality', label: '实用性' },
  { key: 'technical', label: '技术难度' },
  { key: 'reflectionDepth', label: '反思深度' },
]

export function RatingStars({ projectId, initialRating, disabled, onRated }: RatingStarsProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({
    creativity: initialRating?.creativity || 0,
    practicality: initialRating?.practicality || 0,
    technical: initialRating?.technical || 0,
    reflectionDepth: initialRating?.reflectionDepth || 0,
  })
  const [hovering, setHovering] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const allFilled = Object.values(ratings).every(v => v > 0)

  const handleSubmit = async () => {
    if (!allFilled) return
    setSubmitting(true)

    const res = await fetch('/api/challenges/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, ...ratings }),
    })

    setSubmitting(false)

    if (res.ok) {
      toast({ title: '评分已提交' })
      onRated?.()
    } else {
      const data = await res.json()
      toast({ title: '评分失败', description: data.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-3">
      {DIMENSIONS.map(dim => {
        const current = hovering[dim.key] || ratings[dim.key]
        return (
          <div key={dim.key} className="flex items-center gap-3">
            <span className="text-sm w-20 text-muted-foreground">{dim.label}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  disabled={disabled}
                  className="p-0.5 disabled:cursor-default"
                  onMouseEnter={() => !disabled && setHovering(h => ({ ...h, [dim.key]: star }))}
                  onMouseLeave={() => !disabled && setHovering(h => ({ ...h, [dim.key]: 0 }))}
                  onClick={() => !disabled && setRatings(r => ({ ...r, [dim.key]: star }))}
                >
                  <Star
                    className={cn(
                      'h-5 w-5 transition-colors',
                      star <= current ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    )}
                  />
                </button>
              ))}
            </div>
            {ratings[dim.key] > 0 && (
              <span className="text-xs text-muted-foreground">{ratings[dim.key]}/5</span>
            )}
          </div>
        )
      })}
      {!disabled && (
        <Button size="sm" onClick={handleSubmit} disabled={!allFilled || submitting} className="mt-2">
          {submitting ? '提交中...' : initialRating ? '更新评分' : '提交评分'}
        </Button>
      )}
    </div>
  )
}
